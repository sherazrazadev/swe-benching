package vtests

import "testing"

// An expression rule that decides on the request URL must see the client's URL when
// the request reaches Anubis through a fronting proxy.
func TestSec_ExpressionPath_ForwardedRequest(t *testing.T) {
	r := runCheck(t, denyExpression(`path == "/admin"`), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/admin",
	})
	denied(t, r)
}

// The expression's path value must be the path, not the whole request target.
func TestSec_ExpressionPath_RequestWithParameters(t *testing.T) {
	r := runCheck(t, denyExpression(`path == "/admin"`), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/admin?x=1",
	})
	denied(t, r)
}

// An expression that decides on the parameters the client sent must see them.
func TestSec_ExpressionParameters_ForwardedRequest(t *testing.T) {
	r := runCheck(t, denyExpression(`query.exists(k, k == "blocked")`), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/admin?blocked=1",
	})
	denied(t, r)
}

// The same, with the client URL carried the other way round.
func TestSec_ExpressionParameters_OriginalRequest(t *testing.T) {
	r := runCheck(t, denyExpression(`query.exists(k, k == "blocked")`), true, checkEndpoint, map[string]string{
		"X-Original-URI": "/admin?blocked=1",
	})
	denied(t, r)
}

// An expression that decides on the whole URL the client requested must see it,
// parameters included.
func TestSec_ExpressionWholeURL_ForwardedRequest(t *testing.T) {
	r := runCheck(t, denyExpression(`requestUri == "/admin?x=1"`), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/admin?x=1",
	})
	denied(t, r)
}
