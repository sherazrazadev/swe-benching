package vtests

import "testing"

// The client asked for /admin through a fronting proxy that represents the original
// request in forwarding information rather than in the request URL.
func TestSec_PathRegex_ForwardedRequest(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/admin",
	})
	denied(t, r)
}

// The path rule must match the path alone when the forwarded request carries
// parameters, even when the proxy already provides the client URL.
func TestSec_PathRegex_RequestWithParameters(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), true, checkEndpoint, map[string]string{
		"X-Original-URI": "/admin?x=1",
	})
	denied(t, r)
}

// Same path rule, parameter carrying request, represented the other way round.
func TestSec_PathRegex_RequestWithParametersForwarded(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/admin?x=1",
	})
	denied(t, r)
}

// A new-style path matcher must apply to the client's path too.
func TestSec_PathPrefix_ForwardedRequest(t *testing.T) {
	r := runCheck(t, denyPathPrefix("/admin/"), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/admin/users",
	})
	denied(t, r)
}
