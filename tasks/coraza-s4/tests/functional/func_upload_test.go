// Copyright 2022 Juan Pablo Tosso and the OWASP Coraza contributors
// SPDX-License-Identifier: Apache-2.0

package vtesting

import "testing"

func vtestFile(name, data string) string {
	return vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="` + name + `"`,
		`Content-Type: application/octet-stream`,
	}, data)
}

// An ordinary single-file upload keeps exactly one reading and the same size
// accounting as today.
func TestFunc_PlainUpload_SingleReadingAndSize(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule FILES "@rx ^report\.pdf$" "id:8101,phase:2,log,pass"
SecRule &FILES "@eq 1" "id:8102,phase:2,log,pass"
SecRule FILES_SIZES:report.pdf "@eq 4" "id:8103,phase:2,log,pass"
SecRule FILES_COMBINED_SIZE "@eq 4" "id:8104,phase:2,log,pass"
SecRule &FILES_NAMES "@eq 1" "id:8105,phase:2,log,pass"
`
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, vtestBody(vtestFile("report.pdf", "DATA")))
	vtestRequireAccepted(t, r)
	for _, id := range []int{8101, 8102, 8103, 8104, 8105} {
		if !r.matched(id) {
			t.Fatalf("ordinary upload: rule %d did not fire; matched %v", id, r.Matched)
		}
	}
	vtestNoRetainedUpload(t, dir)
}

// A single charset-tagged name in UTF-8 stays one reading.
func TestFunc_UTF8ExtendedName_SingleReading(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule FILES "@rx ^rapport\.pdf$" "id:8111,phase:2,log,pass"
SecRule &FILES "@eq 1" "id:8112,phase:2,log,pass"
SecRule FILES_COMBINED_SIZE "@eq 4" "id:8113,phase:2,log,pass"
`
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename*=utf-8''rapport.pdf`,
		`Content-Type: application/pdf`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireAccepted(t, r)
	for _, id := range []int{8111, 8112, 8113} {
		if !r.matched(id) {
			t.Fatalf("utf-8 extended name: rule %d did not fire; matched %v", id, r.Matched)
		}
	}
}

// When a part declares a real plain name and a different extended name, the
// plain name a backend may resolve must stay visible.
func TestFunc_SwappedOrder_PlainNameStaysVisible(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule FILES "@rx ^shell\.php$" "id:8121,phase:2,log,pass"
SecRule FILES "@rx ^looks-safe\.jpg$" "id:8122,phase:2,log,pass"
`
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="shell.php"; filename*=iso-8859-1''looks-safe.jpg`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireAccepted(t, r)
	if !r.matched(8121) {
		t.Fatalf("the plain name was hidden by the extended one; matched %v", r.Matched)
	}
}

// Two equivalent spellings of the same name remain one reading.
func TestFunc_EqualReadings_OneEntry(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule FILES "@rx ^rapport\.pdf$" "id:8131,phase:2,log,pass"
SecRule &FILES "@eq 1" "id:8132,phase:2,log,pass"
SecRule FILES_SIZES:rapport.pdf "@eq 4" "id:8133,phase:2,log,pass"
`
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="rapport.pdf"; filename*=iso-8859-1''rapport.pdf`,
		`Content-Type: application/pdf`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireAccepted(t, r)
	for _, id := range []int{8131, 8132, 8133} {
		if !r.matched(id) {
			t.Fatalf("equal spellings: rule %d did not fire; matched %v", id, r.Matched)
		}
	}
}

// A multi-file input with two parts under one form name keeps both files.
func TestFunc_MultiFile_SameFormName(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule FILES "@rx ^a\.txt$" "id:8141,phase:2,log,pass"
SecRule FILES "@rx ^b\.txt$" "id:8142,phase:2,log,pass"
SecRule &FILES "@eq 2" "id:8143,phase:2,log,pass"
SecRule &FILES_NAMES "@eq 2" "id:8144,phase:2,log,pass"
`
	body := vtestBody(
		vtestPart([]string{`Content-Disposition: form-data; name="files"; filename="a.txt"`}, "AAAA"),
		vtestPart([]string{`Content-Disposition: form-data; name="files"; filename="b.txt"`}, "BBBB"),
	)
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireAccepted(t, r)
	for _, id := range []int{8141, 8142, 8143, 8144} {
		if !r.matched(id) {
			t.Fatalf("multi-file input: rule %d did not fire; matched %v", id, r.Matched)
		}
	}
}

// An ordinary form field is still a form field, not an upload.
func TestFunc_PlainFormField(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule ARGS_POST:note "@rx hello" "id:8151,phase:2,log,pass"
SecRule &FILES "@eq 0" "id:8152,phase:2,log,pass"
SecRule MULTIPART_STRICT_ERROR "!@eq 0" "id:8153,phase:2,log,pass"
`
	body := vtestBody(vtestPart([]string{`Content-Disposition: form-data; name="note"`}, "hello"))
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireAccepted(t, r)
	if !r.matched(8151) || !r.matched(8152) {
		t.Fatalf("ordinary form field: matched %v", r.Matched)
	}
	if r.matched(8153) {
		t.Fatalf("an ordinary form field was reported as malformed")
	}
}

// A charset-tagged form-field name that already resolves in UTF-8 keeps one
// entry under the resolved name.
func TestFunc_UTF8ExtendedFieldName(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule ARGS_POST:feedback "@rx hello" "id:8161,phase:2,log,pass"
SecRule &ARGS_POST "@eq 1" "id:8162,phase:2,log,pass"
`
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="feedback"; name*=utf-8''feedback`,
	}, "hello"))
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireAccepted(t, r)
	for _, id := range []int{8161, 8162} {
		if !r.matched(id) {
			t.Fatalf("utf-8 field name: rule %d did not fire; matched %v", id, r.Matched)
		}
	}
}

// An ordinary file part whose content type carries its own parameters is not
// a container and must not lose its name.
func TestFunc_OrdinaryContentTypeWithParameters(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule FILES "@rx ^report\.pdf$" "id:8171,phase:2,log,pass"
SecRule &FILES "@eq 1" "id:8172,phase:2,log,pass"
`
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="report.pdf"`,
		`Content-Type: application/pdf; name="report.pdf"; charset=binary`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireAccepted(t, r)
	for _, id := range []int{8171, 8172} {
		if !r.matched(id) {
			t.Fatalf("ordinary content type: rule %d did not fire; matched %v", id, r.Matched)
		}
	}
}
