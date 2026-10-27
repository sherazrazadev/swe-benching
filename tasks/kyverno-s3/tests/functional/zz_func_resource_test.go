package vtesting

import (
	"strings"
	"testing"

	kv1 "github.com/kyverno/kyverno/api/kyverno/v1"
)

func TestFunc_NamespacedPolicyOwnNamespaceResource(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenResourceEntry("own", "", "v1", "configmaps", "team-a", "team-config"),
	})
	if err != nil {
		t.Fatalf("a namespaced policy could not read a resource in its own namespace: %v", err)
	}
	paths := h.client.recordedPaths()
	if len(paths) != 1 || !strings.Contains(paths[0], "/namespaces/team-a/configmaps/team-config") {
		t.Fatalf("the own-namespace resource request was not made as expected: %v", paths)
	}
}

func TestFunc_NamespacedPolicyOwnNamespaceGroupResource(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenResourceEntry("owngroup", "apps", "v1", "deployments", "team-a", "team-app"),
	})
	if err != nil {
		t.Fatalf("a namespaced policy could not read a grouped resource in its own namespace: %v", err)
	}
	paths := h.client.recordedPaths()
	if len(paths) != 1 || !strings.Contains(paths[0], "/apis/apps/v1/namespaces/team-a/deployments/team-app") {
		t.Fatalf("the grouped own-namespace request was not made as expected: %v", paths)
	}
}

func TestFunc_ClusterPolicyUnrestrictedResource(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenClusterPolicy(), []kv1.ContextEntry{
		hiddenResourceEntry("cluster", "", "v1", "secrets", "other", "other-secret"),
	})
	if err != nil {
		t.Fatalf("a cluster-scoped policy lost its unrestricted resource access: %v", err)
	}
	if paths := h.client.recordedPaths(); len(paths) != 1 {
		t.Fatalf("the cluster-scoped resource request was not made: %v", paths)
	}
}
