// Shared harness for the hidden suites. Copied beside the product tree at grading time; it uses
// only the webhook's exported entry point and ordinary Kubernetes types.
package main

import (
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/spf13/viper"
	"github.com/slok/kubewebhook/v2/pkg/model"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/kubernetes/fake"

	wh "github.com/bank-vaults/vault-secrets-webhook/pkg/webhook"
)

const (
	ns              = "test-ns"
	addrAnnotation  = "vault.security.banzaicloud.io/vault-addr"
	skipAnnotation  = "vault.security.banzaicloud.io/vault-skip-verify"
	saAnnotation    = "vault.security.banzaicloud.io/vault-serviceaccount"
	roleAnnotation  = "vault.security.banzaicloud.io/vault-role"
	regSkipAnnot    = "vault.security.banzaicloud.io/registry-skip-verify"
	agentAnnotation = "vault.security.banzaicloud.io/vault-agent"
)

// hitSpy records whether a peer received any application request.
type hitSpy struct {
	mu    sync.Mutex
	paths []string
}

func (s *hitSpy) record(r *http.Request) {
	s.mu.Lock()
	s.paths = append(s.paths, r.Method+" "+r.URL.Path)
	s.mu.Unlock()
}

func (s *hitSpy) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.paths)
}

func (s *hitSpy) snapshot() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.paths...)
}

// vaultPeer is a harmless stand-in Vault: it answers the login and a KV v2 read so that the
// vulnerable code can get all the way through, and counts every request it receives.
func vaultPeer(spy *hitSpy) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		spy.record(r)
		w.Header().Set("Content-Type", "application/json")
		switch {
		case strings.Contains(r.URL.Path, "/login"):
			_, _ = w.Write([]byte(`{"auth":{"client_token":"tok","lease_duration":3600,"renewable":false}}`))
		default:
			_, _ = w.Write([]byte(`{"data":{"data":{"k":"v"},"metadata":{"destroyed":false,"version":1}}}`))
		}
	}
}

func newTestWebhook(t *testing.T) *wh.MutatingWebhook {
	t.Helper()
	t.Setenv("KUBERNETES_NAMESPACE", ns)
	// Keep a failed Vault login from waiting out the library's 10s default in a refused test.
	t.Setenv("VAULT_CLIENT_TIMEOUT", "1s")

	mw, err := wh.NewMutatingWebhook(slog.New(slog.DiscardHandler), fake.NewClientset(
		&corev1.ServiceAccount{
			ObjectMeta: metav1.ObjectMeta{Name: "test-sa", Namespace: ns},
			Secrets:    []corev1.ObjectReference{{Name: "test-sa-token"}},
		},
		&corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{Name: "test-sa-token", Namespace: ns},
			Data:       map[string][]byte{"token": []byte("sa-token")},
		},
	))
	if err != nil {
		t.Fatalf("new webhook: %v", err)
	}
	return mw
}

func setViper(t *testing.T, key string, value interface{}) {
	t.Helper()
	old := viper.Get(key)
	if old == nil {
		old = ""
	}
	viper.Set(key, value)
	t.Cleanup(func() { viper.Set(key, old) })
}

func review() *model.AdmissionReview { return &model.AdmissionReview{Namespace: ns} }

func objectAnnotations(addr, serviceAccount string, extra map[string]string) map[string]string {
	a := map[string]string{roleAnnotation: "test-role"}
	if addr != "" {
		a[addrAnnotation] = addr
	}
	if serviceAccount != "" {
		a[saAnnotation] = serviceAccount
	}
	for k, v := range extra {
		a[k] = v
	}
	return a
}

func secretObject(annotations map[string]string) *corev1.Secret {
	return &corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "sec", Namespace: ns, Annotations: annotations},
		Data:       map[string][]byte{"k": []byte("vault:secret/data/x#k")},
	}
}

func configMapObject(annotations map[string]string) *corev1.ConfigMap {
	return &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{Name: "cm", Namespace: ns, Annotations: annotations},
		Data:       map[string]string{"k": "vault:secret/data/x#k"},
	}
}

func unstructuredObject(annotations map[string]string) *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "ConfigMap",
		"metadata": map[string]interface{}{
			"name":        "obj",
			"namespace":   ns,
			"annotations": toUnstructuredMap(annotations),
		},
		"data": map[string]interface{}{"k": "vault:secret/data/x#k"},
	}}
}

func toUnstructuredMap(in map[string]string) map[string]interface{} {
	out := make(map[string]interface{}, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func podWithEnv(annotations map[string]string, image string, command []string) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "pod", Namespace: ns, Annotations: annotations},
		Spec: corev1.PodSpec{Containers: []corev1.Container{{
			Name:    "app",
			Image:   image,
			Command: command,
			Env:     []corev1.EnvVar{{Name: "SECRET", Value: "vault:secret/data/x#k"}},
		}}},
	}
}

func mustRefuse(t *testing.T, err error, spy *hitSpy, what string) {
	t.Helper()
	if err == nil {
		t.Fatalf("%s: request was accepted, expected a client error", what)
	}
	mustNotConnect(t, spy, what)
}

func mustNotConnect(t *testing.T, spy *hitSpy, what string) {
	t.Helper()
	if n := spy.count(); n != 0 {
		t.Fatalf("%s: the webhook opened a connection to the object-supplied peer (%d request(s): %v)",
			what, n, spy.snapshot())
	}
}

func envValue(pod *corev1.Pod, container, name string) (string, bool) {
	for _, c := range pod.Spec.Containers {
		if c.Name != container {
			continue
		}
		for _, e := range c.Env {
			if e.Name == name {
				return e.Value, true
			}
		}
	}
	return "", false
}
