package vtesting

import (
	"strings"
	"testing"

	kv1 "github.com/kyverno/kyverno/api/kyverno/v1"
	"github.com/kyverno/kyverno/pkg/engine/context/resolvers"
	c1 "k8s.io/api/core/v1"
	meta1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	kubefake "k8s.io/client-go/kubernetes/fake"
)

func TestSec_ConfigMapCrossNamespace(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenConfigMapEntry("cross", "other", "other-config"),
	})
	if err == nil {
		t.Fatalf("a config map outside the policy namespace was accepted")
	}
	for _, call := range h.resolver.(*hiddenConfigMapResolver).recordedCalls() {
		if !strings.HasPrefix(call, "team-a/") {
			t.Fatalf("the refused context entry still resolved %q", call)
		}
	}
	hiddenAssertNotBound(t, h, "cross")
}

func TestSec_ConfigMapEmptySubstitutedNamespace(t *testing.T) {
	h := newHiddenHarness()
	if err := h.jsonContext.AddVariable("hiddenTeam", ""); err != nil {
		t.Fatalf("cannot set the substitution fixture: %v", err)
	}
	_ = h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenConfigMapEntry("empty", "{{ hiddenTeam }}", "some-config"),
	})
	for _, call := range h.resolver.(*hiddenConfigMapResolver).recordedCalls() {
		if !strings.HasPrefix(call, "team-a/") {
			t.Fatalf("an empty target namespace resolved outside the policy namespace: %q", call)
		}
	}
}

// The requested namespace is inside the policy, but the data source resolves the object
// from another namespace when it is absent locally; the data must not be bound.
func TestSec_ConfigMapSharedNamespaceFallback(t *testing.T) {
	client := kubefake.NewSimpleClientset(
		&c1.ConfigMap{
			ObjectMeta: meta1.ObjectMeta{Name: "shared-config", Namespace: "default"},
			Data:       map[string]string{"value": "foreign"},
		},
	)
	resolver, err := resolvers.NewClientBasedResolver(client)
	if err != nil {
		t.Fatalf("cannot build the resolver fixture: %v", err)
	}
	h := newHiddenHarness()
	h.resolver = resolver
	err = h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenConfigMapEntry("shared", "team-a", "shared-config"),
	})
	if err == nil {
		t.Fatalf("data from outside the policy namespace was accepted")
	}
	hiddenAssertNotBound(t, h, "shared")
}
