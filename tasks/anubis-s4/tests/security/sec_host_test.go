package vtests

import "testing"

// A rule that decides on the host of the client's request must see the host the
// client asked for when a fronting proxy reports it.
func TestSec_ExpressionHost_ForwardedHostHeader(t *testing.T) {
	r := runCheck(t, denyExpression(`host == "app.example"`), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri":  "/admin",
		"X-Forwarded-Host": "app.example",
	})
	denied(t, r)
}

// The host the client asked for can also be named in the forwarded request
// target itself rather than in a separate forwarding field.
func TestSec_ExpressionHost_AbsoluteFormTarget(t *testing.T) {
	r := runCheck(t, denyExpression(`host == "app.example"`), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "https://app.example/admin",
	})
	denied(t, r)
}

// The same request target represented in the other forwarding field.
func TestSec_ExpressionHost_OriginalRequestTarget(t *testing.T) {
	r := runCheck(t, denyExpression(`host == "app.example"`), true, checkEndpoint, map[string]string{
		"X-Original-URI": "https://app.example/admin",
	})
	denied(t, r)
}
