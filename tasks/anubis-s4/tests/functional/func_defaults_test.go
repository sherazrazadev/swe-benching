package vtests

import "testing"

// A forwarded request whose client path fails the policy-wide condition is
// served normally.
func TestFunc_DefaultsPathNonMatchingForwarded(t *testing.T) {
	r := runCheck(t, denyDefaultsPathRegex("^/admin$"), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/public/page",
	})
	allowed(t, r)
}

// In a deployment where Anubis serves the traffic itself, the policy-wide
// condition keeps matching the request path as it does today.
func TestFunc_DefaultsPathDirect(t *testing.T) {
	r := runCheck(t, denyDefaultsPathRegex("^/admin$"), false, "/admin", nil)
	denied(t, r)
}

// A direct request that the condition does not name keeps reaching the origin.
func TestFunc_DefaultsPathDirectPublic(t *testing.T) {
	r := runCheck(t, denyDefaultsPathRegex("^/admin$"), false, "/public", nil)
	allowed(t, r)
}
