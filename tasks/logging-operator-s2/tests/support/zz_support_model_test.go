// Test support for the logging-operator fluentd configuration suites.
package model_test

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/cisco-open/operator-tools/pkg/secret"
	"github.com/go-logr/logr"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kube-logging/logging-operator/pkg/resources/model"
	"github.com/kube-logging/logging-operator/pkg/sdk/logging/api/v1beta1"
	"github.com/kube-logging/logging-operator/pkg/sdk/logging/model/output"
	"github.com/kube-logging/logging-operator/pkg/sdk/logging/model/render"
)

// secMarker is a token that, if it ever becomes a configuration line of its own,
// proves that a supplied value escaped the position it was written into.
const secMarker = "zzinjectedmarker"

type secretReader struct{ items []corev1.Secret }

func (r secretReader) Get(_ context.Context, key client.ObjectKey, obj client.Object, _ ...client.GetOption) error {
	s, ok := obj.(*corev1.Secret)
	if !ok {
		return fmt.Errorf("unexpected object %T", obj)
	}
	for i := range r.items {
		if r.items[i].Namespace == key.Namespace && r.items[i].Name == key.Name {
			*s = *r.items[i].DeepCopy()
			return nil
		}
	}
	return apierrors.NewNotFound(schema.GroupResource{Resource: "secrets"}, key.Name)
}

func (r secretReader) List(context.Context, client.ObjectList, ...client.ListOption) error { return nil }

type secretFactory struct{ reader secretReader }

func (f secretFactory) OutputSecretLoaderForNamespace(namespace string) secret.SecretLoader {
	mounts := secret.MountSecrets{}
	return secret.NewSecretLoader(f.reader, namespace, "/fluentd/etc/secret", &mounts)
}

func testLogging() v1beta1.Logging {
	return v1beta1.Logging{
		ObjectMeta: metav1.ObjectMeta{Name: "logging", Namespace: "control"},
		Spec: v1beta1.LoggingSpec{
			ControlNamespace: "control",
			FluentdSpec:      &v1beta1.FluentdSpec{},
		},
	}
}

func nullOutput(name, namespace string) v1beta1.Output {
	return v1beta1.Output{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec:       v1beta1.OutputSpec{NullOutputConfig: &output.NullOutputConfig{}},
	}
}

func nullClusterOutput(name string) v1beta1.ClusterOutput {
	return v1beta1.ClusterOutput{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "control"},
		Spec: v1beta1.ClusterOutputSpec{OutputSpec: v1beta1.OutputSpec{
			NullOutputConfig: &output.NullOutputConfig{},
		}},
	}
}

// flowTo builds the simplest namespace flow that emits to the named local output.
func flowTo(namespace, outputName string, mutate func(*v1beta1.Flow)) v1beta1.Flow {
	flow := v1beta1.Flow{
		ObjectMeta: metav1.ObjectMeta{Name: "flow", Namespace: namespace},
		Spec: v1beta1.FlowSpec{
			LocalOutputRefs: []string{outputName},
			Selectors:       map[string]string{"app": "demo"},
		},
	}
	if mutate != nil {
		mutate(&flow)
	}
	return flow
}

// renderSystem drives the same pipeline the logging controller drives: the model
// is built from the configuration objects and then rendered to fluentd config.
func renderSystem(t *testing.T, res model.LoggingResources, reader secretReader) (string, error) {
	t.Helper()
	sys, err := model.CreateSystem(res, secretFactory{reader: reader}, logr.Discard())
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	r := render.FluentRender{Out: &buf, Indent: 2}
	err = r.Render(sys)
	return buf.String(), err
}

// assertNoInjection fails when the generator produced configuration and the
// marker ended up as a line/token of its own. A clean error is a valid refusal.
func assertNoInjection(t *testing.T, out string, err error) {
	t.Helper()
	if err != nil {
		return
	}
	for _, token := range strings.FieldsFunc(out, func(r rune) bool { return r == '\n' || r == '\r' }) {
		if strings.HasPrefix(strings.TrimSpace(token), secMarker) {
			t.Fatalf("a supplied value escaped its position and became configuration:\n%s", out)
		}
	}
}

func assertContains(t *testing.T, out string, want ...string) {
	t.Helper()
	for _, w := range want {
		if !strings.Contains(out, w) {
			t.Fatalf("generated configuration does not contain %q:\n%s", w, out)
		}
	}
}
