package vtesting

import (
	"testing"

	kv1 "github.com/kyverno/kyverno/api/kyverno/v1"
)

// The typed object-source cases. They drive the same context loader for a policy that
// belongs to "team-a" and must not reach anything outside it.

func TestSec_ResourceCrossNamespace(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenResourceEntry("res", "", "v1", "secrets", "other", "other-secret"),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "res")
}

func TestSec_ResourceClusterWide(t *testing.T) {
	h := newHiddenHarness()
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenResourceEntry("res", "", "v1", "secrets", "", ""),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "res")
}

func TestSec_ResourceSubstitutedNamespace(t *testing.T) {
	h := newHiddenHarness()
	if err := h.jsonContext.AddVariable("hiddenTarget", "other"); err != nil {
		t.Fatalf("cannot set the substitution fixture: %v", err)
	}
	err := h.load(hiddenNamespacedPolicy("team-a"), []kv1.ContextEntry{
		hiddenResourceEntry("res", "", "v1", "secrets", "{{ hiddenTarget }}", "other-secret"),
	})
	hiddenAssertRefused(t, h, err)
	hiddenAssertNotBound(t, h, "res")
}
