// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

// Package webhookcheck drives the autobuild webhook endpoint through the real
// generated HTTP router, handler, service and processor, with a fake Kubernetes
// client and a recording workflow trigger.
package webhookcheck

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	openchoreov1alpha1 "github.com/openchoreo/openchoreo/api/v1alpha1"
	"github.com/openchoreo/openchoreo/internal/openchoreo-api/api/gen"
	"github.com/openchoreo/openchoreo/internal/openchoreo-api/api/handlers"
	"github.com/openchoreo/openchoreo/internal/openchoreo-api/models"
	autobuildsvc "github.com/openchoreo/openchoreo/internal/openchoreo-api/services/autobuild"
	"github.com/openchoreo/openchoreo/internal/openchoreo-api/services/handlerservices"
)

const (
	secretNamespace = "openchoreo-control-plane"
	secretName      = "git-webhook-secrets"

	testNamespace = "acme-dev"
	testProject   = "shop"

	// workflowSchema marks the repository URL and the branch in the workflow's
	// parameter schema, which is how a component's repository is located.
	workflowSchema = `{"type":"object","properties":{"repository":{"type":"object","properties":{"url":{"type":"string","x-openchoreo-component-parameter-repository-url":true},"revision":{"type":"object","properties":{"branch":{"type":"string","x-openchoreo-component-parameter-repository-branch":true}}}}}}}`
)

// TriggerCall records one workflow run the webhook path asked for.
type TriggerCall struct {
	Namespace string
	Project   string
	Component string
	Commit    string
}

type fakeTrigger struct {
	calls []TriggerCall
}

func (f *fakeTrigger) TriggerWorkflow(_ context.Context, namespaceName, projectName, componentName, commit string) (*models.WorkflowRunTriggerResponse, error) {
	f.calls = append(f.calls, TriggerCall{Namespace: namespaceName, Project: projectName, Component: componentName, Commit: commit})
	return &models.WorkflowRunTriggerResponse{
		Name:          componentName + "-run",
		NamespaceName: namespaceName,
		ProjectName:   projectName,
		ComponentName: componentName,
		Commit:        commit,
		Status:        "Pending",
	}, nil
}

// Env is one isolated deployment: a fake cluster, a recording trigger and the
// HTTP router the product serves the webhook endpoint on.
type Env struct {
	T       *testing.T
	Client  client.Client
	Trigger *fakeTrigger
	Handler http.Handler
}

// NewEnv builds the deployment with the given objects already in the cluster.
func NewEnv(t *testing.T, objs ...client.Object) *Env {
	t.Helper()
	scheme := runtime.NewScheme()
	if err := corev1.AddToScheme(scheme); err != nil {
		t.Fatalf("register corev1 scheme: %v", err)
	}
	if err := openchoreov1alpha1.AddToScheme(scheme); err != nil {
		t.Fatalf("register openchoreo scheme: %v", err)
	}
	fc := fake.NewClientBuilder().WithScheme(scheme).WithObjects(objs...).Build()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	trigger := &fakeTrigger{}
	processor := autobuildsvc.NewWebhookProcessor(fc, trigger, logger)
	svc := autobuildsvc.NewService(fc, processor, logger)
	h := handlers.New(&handlerservices.Services{AutoBuildService: svc}, logger, nil)
	strict := gen.NewStrictHandler(h, nil)
	mux := http.NewServeMux()
	gen.HandlerWithOptions(strict, gen.StdHTTPServerOptions{
		BaseRouter:  mux,
		Middlewares: []gen.MiddlewareFunc{handlers.WebhookRawBodyMiddleware},
	})
	return &Env{T: t, Client: fc, Trigger: trigger, Handler: mux}
}

// Post sends a webhook to the product's endpoint.
func (e *Env) Post(body []byte, headers map[string]string) *httptest.ResponseRecorder {
	e.T.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1alpha1/autobuild", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	e.Handler.ServeHTTP(rec, req)
	return rec
}

// Components returns the distinct component names the trigger was asked for.
func (e *Env) Components() []string {
	out := make([]string, 0, len(e.Trigger.calls))
	for _, c := range e.Trigger.calls {
		out = append(out, c.Component)
	}
	return out
}

// Triggered reports whether the path started a build for the named component.
func (e *Env) Triggered(component string) bool {
	for _, c := range e.Trigger.calls {
		if c.Component == component {
			return true
		}
	}
	return false
}

// Secret builds the deployment's webhook secret with the given provider keys.
func Secret(keys map[string]string) *corev1.Secret {
	data := make(map[string][]byte, len(keys))
	for k, v := range keys {
		data[k] = []byte(v)
	}
	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: secretName, Namespace: secretNamespace},
		Data:       data,
	}
}

// Workflow builds the build workflow whose parameter schema locates the
// repository URL and the branch.
func Workflow(namespace, name string) *openchoreov1alpha1.Workflow {
	return &openchoreov1alpha1.Workflow{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: openchoreov1alpha1.WorkflowSpec{
			Parameters: &openchoreov1alpha1.SchemaSection{
				OpenAPIV3Schema: &runtime.RawExtension{Raw: []byte(workflowSchema)},
			},
		},
	}
}

// WorkflowParams is the component's repository configuration.
type WorkflowParams struct {
	URL      string
	Branch   string
	Workflow string
}

// Component builds an auto-build component that builds from repoURL on branch.
func Component(namespace, project, name string, repoURL, branch string) *openchoreov1alpha1.Component {
	autoBuild := true
	return ComponentWith(namespace, project, name, WorkflowParams{URL: repoURL, Branch: branch, Workflow: "build"}, autoBuild)
}

// ComponentWith builds a component from explicit parameters.
func ComponentWith(namespace, project, name string, params WorkflowParams, autoBuild bool) *openchoreov1alpha1.Component {
	repository := map[string]interface{}{"url": params.URL}
	if params.Branch != "" {
		repository["revision"] = map[string]interface{}{"branch": params.Branch}
	}
	raw, _ := json.Marshal(map[string]interface{}{"repository": repository})
	return &openchoreov1alpha1.Component{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec: openchoreov1alpha1.ComponentSpec{
			Owner:     openchoreov1alpha1.ComponentOwner{ProjectName: project},
			AutoBuild: &autoBuild,
			Workflow: &openchoreov1alpha1.ComponentWorkflowConfig{
				Kind:       openchoreov1alpha1.WorkflowRefKindWorkflow,
				Name:       params.Workflow,
				Parameters: &runtime.RawExtension{Raw: raw},
			},
		},
	}
}

// WithAnnotation returns the component carrying the named annotation.
func WithAnnotation(comp *openchoreov1alpha1.Component, key, value string) *openchoreov1alpha1.Component {
	if comp.Annotations == nil {
		comp.Annotations = map[string]string{}
	}
	comp.Annotations[key] = value
	return comp
}

// NoAutoBuild clears the component's auto-build setting.
func NoAutoBuild(comp *openchoreov1alpha1.Component) *openchoreov1alpha1.Component {
	disabled := false
	comp.Spec.AutoBuild = &disabled
	return comp
}

// Signature returns the "sha256=<hex>" HMAC-SHA256 signature of body under secret.
func Signature(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// BitbucketPush is a Bitbucket Cloud push delivery for repository repoURL.
func BitbucketPush(repoURL, branch, commit string) []byte {
	payload := map[string]interface{}{
		"push": map[string]interface{}{
			"changes": []interface{}{
				map[string]interface{}{
					"new":     map[string]interface{}{"name": branch, "type": "branch"},
					"commits": []interface{}{map[string]interface{}{"hash": commit}},
				},
			},
		},
		"repository": map[string]interface{}{
			"links": map[string]interface{}{
				"html": map[string]interface{}{"href": repoURL},
			},
		},
	}
	body, _ := json.Marshal(payload)
	return body
}

// BitbucketDataCenterPush is a Bitbucket Data Center push delivery for repoURL.
func BitbucketDataCenterPush(repoURL, branch, commit string) []byte {
	payload := map[string]interface{}{
		"eventKey": "repo:refs_changed",
		"push": map[string]interface{}{
			"changes": []interface{}{
				map[string]interface{}{
					"new":     map[string]interface{}{"name": branch, "type": "branch"},
					"commits": []interface{}{map[string]interface{}{"hash": commit}},
				},
			},
		},
		"repository": map[string]interface{}{
			"project": map[string]interface{}{"key": "ACME"},
			"links": map[string]interface{}{
				"html": map[string]interface{}{"href": repoURL},
			},
		},
	}
	body, _ := json.Marshal(payload)
	return body
}

// GitLabPush is a GitLab push delivery for repoURL.
func GitLabPush(repoURL, branch, commit string) []byte {
	payload := map[string]interface{}{
		"ref":   "refs/heads/" + branch,
		"after": commit,
		"project": map[string]interface{}{
			"git_http_url": repoURL,
			"web_url":      repoURL,
		},
		"commits": []interface{}{
			map[string]interface{}{"added": []string{}, "modified": []string{"src/main.go"}, "removed": []string{}},
		},
	}
	body, _ := json.Marshal(payload)
	return body
}

// GitHubPush is a GitHub push delivery for repoURL.
func GitHubPush(repoURL, branch, commit string) []byte {
	payload := map[string]interface{}{
		"ref":   "refs/heads/" + branch,
		"after": commit,
		"repository": map[string]interface{}{
			"clone_url": repoURL,
			"html_url":  repoURL,
		},
		"commits": []interface{}{
			map[string]interface{}{"added": []string{}, "modified": []string{"src/main.go"}, "removed": []string{}},
		},
	}
	body, _ := json.Marshal(payload)
	return body
}

// Headers for each provider.
func BitbucketHeaders(signature string) map[string]string {
	h := map[string]string{"X-Event-Key": "repo:push"}
	if signature != "" {
		h["X-Hub-Signature"] = signature
	}
	return h
}

func GitHubHeaders(signature string) map[string]string {
	h := map[string]string{}
	if signature != "" {
		h["X-Hub-Signature-256"] = signature
	}
	return h
}

func GitLabHeaders(token string) map[string]string {
	h := map[string]string{}
	if token != "" {
		h["X-Gitlab-Token"] = token
	}
	return h
}

// RequireRefused fails the test unless the request was answered with an error
// response. The exact status is not part of the contract.
func RequireRefused(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	if rec.Code < 400 {
		t.Fatalf("request was not refused: status %d, body %s", rec.Code, rec.Body.String())
	}
}

// RequireAccepted fails the test unless the request was answered with a
// success response.
func RequireAccepted(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	if rec.Code >= 300 {
		t.Fatalf("request was not accepted: status %d, body %s", rec.Code, rec.Body.String())
	}
}

// RequireBuilt fails the test unless the webhook path started a build for the
// named component.
func (e *Env) RequireBuilt(component string) {
	e.T.Helper()
	if !e.Triggered(component) {
		e.T.Fatalf("no build was started for component %q (started for %v)", component, e.Components())
	}
}

// RequireNotBuilt fails the test if the webhook path started a build for the
// named component.
func (e *Env) RequireNotBuilt(component string) {
	e.T.Helper()
	if e.Triggered(component) {
		e.T.Fatalf("a build was started for component %q (started for %v)", component, e.Components())
	}
}
