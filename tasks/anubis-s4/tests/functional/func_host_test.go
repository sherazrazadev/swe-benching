package vtests

import "testing"

// When Anubis serves the traffic itself, a host rule matches the request's own
// host exactly as it does today.
func TestFunc_ExpressionHostDirect(t *testing.T) {
	r := runCheckWithHost(t, denyExpression(`host == "direct.example"`), false, "/admin", nil, "direct.example")
	denied(t, r)
}

// An authorization call naming a different host does not match the rule, so the
// request keeps reaching the origin.
func TestFunc_ExpressionHostForwardedOther(t *testing.T) {
	r := runCheck(t, denyExpression(`host == "app.example"`), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri":  "/admin",
		"X-Forwarded-Host": "public.example",
	})
	allowed(t, r)
}

// An authorization call that names no client host is judged on the URL the call
// itself has, exactly as before.
func TestFunc_ExpressionHostFallback(t *testing.T) {
	r := runCheckWithHost(t, denyExpression(`host == "anubis.internal"`), true, checkEndpoint, map[string]string{
		"X-Forwarded-Uri": "/admin",
	}, "anubis.internal")
	denied(t, r)
}
