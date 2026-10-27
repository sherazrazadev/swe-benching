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

func TestFunc_NamespacedPolicyOwnNamespaceAPICall(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("own", "/api/v1/namespaces/team-a/configmaps", "GET"),
	})
	if err != nil {
		t.Fatalf("a namespaced policy could not read its own namespace: %v", err)
	}
	paths := h.client.recordedPaths()
	if len(paths) != 1 || !strings.Contains(paths[0], "/namespaces/team-a/") {
		t.Fatalf("the own-namespace request was not made as expected: %v", paths)
	}
}

func TestFunc_NamespacedPolicyOwnNamespaceGroupAPICall(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("owngroup", "/apis/apps/v1/namespaces/team-a/deployments", "GET"),
	})
	if err != nil {
		t.Fatalf("a namespaced policy could not read a resource in its own namespace: %v", err)
	}
	paths := h.client.recordedPaths()
	if len(paths) != 1 || !strings.Contains(paths[0], "/namespaces/team-a/") {
		t.Fatalf("the own-namespace resource request was not made as expected: %v", paths)
	}
}

func TestFunc_NamespacedPolicySubstitutedOwnNamespaceAPICall(t *testing.T) {
	h := newHiddenHarness()
	if err := h.jsonContext.AddVariable("hiddenTarget", "team-a"); err != nil {
		t.Fatalf("cannot set the substitution fixture: %v", err)
	}
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("substituted", "/api/v1/namespaces/{{ hiddenTarget }}/configmaps", "GET"),
	})
	if err != nil {
		t.Fatalf("a namespaced policy could not use a variable resolving to its own namespace: %v", err)
	}
	paths := h.client.recordedPaths()
	if len(paths) != 1 || !strings.Contains(paths[0], "/namespaces/team-a/") {
		t.Fatalf("the substituted own-namespace request was not made as expected: %v", paths)
	}
}

func TestFunc_ClusterPolicyUnrestrictedAPICall(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenClusterPolicy(), []kv1.ContextEntry{
		hiddenAPICallEntry("cluster", "/api/v1/namespaces/other/secrets/other-secret", "GET"),
	})
	if err != nil {
		t.Fatalf("a cluster-scoped policy lost its unrestricted access: %v", err)
	}
	if paths := h.client.recordedPaths(); len(paths) != 1 {
		t.Fatalf("the cluster-scoped request was not made: %v", paths)
	}
}

func TestFunc_NamespacedPolicyOwnNamespaceConfigMap(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenConfigMapEntry("own", "team-a", "team-config"),
	})
	if err != nil {
		t.Fatalf("a namespaced policy could not read a config map in its own namespace: %v", err)
	}
	calls := h.resolver.(*hiddenConfigMapResolver).recordedCalls()
	if len(calls) != 1 || calls[0] != "team-a/team-config" {
		t.Fatalf("unexpected config map resolution: %v", calls)
	}
}

func TestFunc_ClusterPolicyDefaultNamespaceConfigMap(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenClusterPolicy(), []kv1.ContextEntry{
		hiddenConfigMapEntry("defaulted", "", "cluster-config"),
	})
	if err != nil {
		t.Fatalf("a cluster-scoped policy lost the existing default-namespace behaviour: %v", err)
	}
	calls := h.resolver.(*hiddenConfigMapResolver).recordedCalls()
	if len(calls) != 1 || calls[0] != "default/cluster-config" {
		t.Fatalf("unexpected default-namespace resolution: %v", calls)
	}
}

func TestFunc_ClusterPolicyCrossNamespaceConfigMap(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenClusterPolicy(), []kv1.ContextEntry{
		hiddenConfigMapEntry("cross", "other", "other-config"),
	})
	if err != nil {
		t.Fatalf("a cluster-scoped policy lost its unrestricted config map access: %v", err)
	}
	calls := h.resolver.(*hiddenConfigMapResolver).recordedCalls()
	if len(calls) != 1 || calls[0] != "other/other-config" {
		t.Fatalf("unexpected cross-namespace resolution: %v", calls)
	}
}

// The same own-namespace read through the product's live resolver implementation must
// keep working: an object that really exists in the policy namespace is served.
func TestFunc_NamespacedPolicyOwnNamespaceConfigMapLiveResolver(t *testing.T) {
	client := kubefake.NewSimpleClientset(
		&c1.ConfigMap{
			ObjectMeta: meta1.ObjectMeta{Name: "team-config", Namespace: "team-a"},
			Data:       map[string]string{"value": "team"},
		},
	)
	resolver, err := resolvers.NewClientBasedResolver(client)
	if err != nil {
		t.Fatalf("cannot build the resolver fixture: %v", err)
	}
	h := newHiddenHarness()
	h.resolver = resolver
	err = h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenConfigMapEntry("own", "team-a", "team-config"),
	})
	if err != nil {
		t.Fatalf("a namespaced policy could not read its own config map: %v", err)
	}
	hiddenAssertBound(t, h, "own")
}
