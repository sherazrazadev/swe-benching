package vtesting

import (
	"testing"

	kv1 "github.com/kyverno/kyverno/api/kyverno/v1"
)

// The API-path cases. Each one drives the real context loader for a policy that
// belongs to "team-a" and must not reach anything outside it.

func TestSec_APICallCrossNamespace(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("cross", "/api/v1/namespaces/other/secrets/other-secret", "GET"),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "cross")
}

func TestSec_APICallDotSegment(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("dotdot", "/api/v1/namespaces/team-a/../../namespaces/other/secrets/other-secret", "GET"),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "dotdot")
}

func TestSec_APICallNamespacePrefixCollision(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("prefix", "/api/v1/namespaces/team-a-other/secrets/other-secret", "GET"),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "prefix")
}

func TestSec_APICallClusterWideList(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("allnamespaces", "/api/v1/secrets", "GET"),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "allnamespaces")
}

func TestSec_APICallClusterScopedObject(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("ownnamespaceobject", "/api/v1/namespaces/team-a", "GET"),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "ownnamespaceobject")
}

func TestSec_APICallSubstitutedNamespace(t *testing.T) {
	h := newHiddenHarness()
	if err := h.jsonContext.AddVariable("hiddenTarget", "other"); err != nil {
		t.Fatalf("cannot set the substitution fixture: %v", err)
	}
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("substituted", "/api/v1/namespaces/{{ hiddenTarget }}/secrets/other-secret", "GET"),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "substituted")
}

func TestSec_APICallWriteCrossNamespace(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenAPICallEntry("write", "/api/v1/namespaces/other/configmaps", "POST"),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "write")
}
