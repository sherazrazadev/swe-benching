package vtests

import "testing"

// A request no rule matches keeps reaching the origin.
func TestFunc_UnmatchedRequestIsServed(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/public/page",
	})
	allowed(t, r)
}

// The same for a deployment where Anubis proxies the traffic itself.
func TestFunc_UnmatchedDirectRequestIsServed(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), false, "/public/page", nil)
	allowed(t, r)
}

// An authorization call that carries no client URL is judged on the URL it has,
// exactly as before.
func TestFunc_AuthorizationCallWithoutClientURL(t *testing.T) {
	r := runCheck(t, denyPathRegex(`^/\.within\.website/.*`), true, checkEndpoint, nil)
	denied(t, r)
}

// When the fronting proxy supplies the client URL as its own forwarding field, a
// request that does not match the rule is still served.
func TestFunc_ForwardedClientURLNotMatching(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/public/page",
	})
	allowed(t, r)
}

// A client cannot change the rule that applies to a request Anubis receives
// directly by adding forwarding information that claims a public path.
func TestFunc_DirectDeploymentIgnoresClientForwarding(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), false, "/admin", map[string]string{
		"X-Original-URI": "/public/page",
	})
	denied(t, r)
}

// Nor by adding forwarding information that claims a denied path.
func TestFunc_DirectDeploymentIgnoresForwardedPath(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), false, "/public/page", map[string]string{
		"X-Forwarded-Uri": "/admin",
	})
	allowed(t, r)
}

// The client URL the proxy supplies is authoritative over the other forwarding
// fields a request might carry.
func TestFunc_ProxySuppliedClientURLWins(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), true, checkEndpoint, map[string]string{
		"X-Original-URI":  "/public/page",
		"X-Forwarded-Uri": "/admin",
	})
	allowed(t, r)
}
