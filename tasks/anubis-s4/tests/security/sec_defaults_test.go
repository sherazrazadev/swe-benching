package vtests

import "testing"

// A path condition configured for the whole policy must be decided on the path
// the client asked for when Anubis authorizes a proxied request.
func TestSec_DefaultsPath_ForwardedRequest(t *testing.T) {
	r := runCheck(t, denyDefaultsPathRegex("^/admin$"), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/admin",
	})
	denied(t, r)
}

// The same condition must still match a client request that carries parameters.
func TestSec_DefaultsPath_RequestWithParameters(t *testing.T) {
	r := runCheck(t, denyDefaultsPathRegex("^/admin$"), true, checkEndpoint, map[string]string{
		"X-Original-URI": "/admin?x=1",
	})
	denied(t, r)
}
