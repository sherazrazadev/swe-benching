package vtests

import "testing"

// An expression path rule keeps working for direct traffic.
func TestFunc_ExpressionPathDirect(t *testing.T) {
	r := runCheck(t, denyExpression(`path == "/admin"`), false, "/admin", nil)
	denied(t, r)
}

// An expression parameter rule keeps working for direct traffic.
func TestFunc_ExpressionParametersDirect(t *testing.T) {
	r := runCheck(t, denyExpression(`query.exists(k, k == "blocked")`), false, "/x?blocked=1", nil)
	denied(t, r)
}

// An expression whose value is the whole request URL keeps working directly.
func TestFunc_ExpressionWholeURLDirect(t *testing.T) {
	r := runCheck(t, denyExpression(`requestUri == "/x?blocked=1"`), false, "/x?blocked=1", nil)
	denied(t, r)
}

// A prefix rule keeps matching direct traffic.
func TestFunc_PathPrefixDirect(t *testing.T) {
	r := runCheck(t, denyPathPrefix("/assets/"), false, "/assets/app.js", nil)
	denied(t, r)
}

// A prefix rule does not match a path that only looks similar.
func TestFunc_PathPrefixDirectUnrelated(t *testing.T) {
	r := runCheck(t, denyPathPrefix("/assets/"), false, "/private/notes.txt", nil)
	allowed(t, r)
}

// A path rule written to match a whole directory keeps matching deeper paths.
func TestFunc_PathRegexDeeperPathDirect(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin/.*"), false, "/admin/users/42", nil)
	denied(t, r)
}

// A path rule that denies one path does not deny its sibling prefix.
func TestFunc_PathRegexSiblingPathDirect(t *testing.T) {
	r := runCheck(t, denyPathRegex("^/admin$"), false, "/administrator", nil)
	allowed(t, r)
}
