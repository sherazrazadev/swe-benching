// Copyright 2022 Juan Pablo Tosso and the OWASP Coraza contributors
// SPDX-License-Identifier: Apache-2.0

package vtesting

import "testing"

// A file carried inside a container part keeps working: one reading, correct
// size, and its content type is not mistaken for a field.
func TestFunc_NestedContainer_PlainFile(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule FILES "@rx ^report\.pdf$" "id:8201,phase:2,log,pass"
SecRule &FILES "@eq 1" "id:8202,phase:2,log,pass"
SecRule FILES_COMBINED_SIZE "@eq 4" "id:8203,phase:2,log,pass"
SecRule MULTIPART_STRICT_ERROR "!@eq 0" "id:8204,phase:2,log,pass"
`
	body := vtestNestedBody([]string{
		`Content-Disposition: attachment; name="inner"; filename="report.pdf"`,
		`Content-Type: application/pdf`,
	}, "DATA")
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireAccepted(t, r)
	for _, id := range []int{8201, 8202, 8203} {
		if !r.matched(id) {
			t.Fatalf("nested plain file: rule %d did not fire; matched %v", id, r.Matched)
		}
	}
	if r.matched(8204) {
		t.Fatalf("an ordinary container part was reported as malformed")
	}
	vtestNoRetainedUpload(t, dir)
}

// An ordinary form field inside a container part still reaches ARGS_POST.
func TestFunc_NestedContainer_PlainField(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule ARGS_POST:note "@rx hello" "id:8211,phase:2,log,pass"
SecRule &FILES "@eq 0" "id:8212,phase:2,log,pass"
`
	body := vtestNestedBody([]string{`Content-Disposition: form-data; name="note"`}, "hello")
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireAccepted(t, r)
	for _, id := range []int{8211, 8212} {
		if !r.matched(id) {
			t.Fatalf("nested plain field: rule %d did not fire; matched %v", id, r.Matched)
		}
	}
}
