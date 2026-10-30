// Copyright 2022 Juan Pablo Tosso and the OWASP Coraza contributors
// SPDX-License-Identifier: Apache-2.0

package vtesting

import "testing"

// The rule below is the policy a deployment would write to refuse an upload
// whose effective name ends in .php. It is the same rule in every case here.
const vtestFileDeny = `
SecRule FILES "@rx shell\.php$" "id:7001,phase:2,deny,status:403,log,msg:'blocked upload name'"
`

func vtestDecoyBody() string {
	return vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="holiday.jpg"; filename*=iso-8859-1''shell.php`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
}

// A part that carries a decoy plain name and the real name in a charset-tagged
// extended name must not hide the real name from the rules.
func TestSec_Filename_DecoyPlainRealExtended(t *testing.T) {
	dir := t.TempDir()
	r := vtestRun(t, vtestBase(dir)+vtestFileDeny, vtestContentType, vtestDecoyBody())
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

// An extended name whose declared charset is not UTF-8, with no plain name at
// all, must still be treated as an uploaded file with that name.
func TestSec_Filename_ExtendedOnly(t *testing.T) {
	dir := t.TempDir()
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename*=iso-8859-1''shell.php`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+vtestFileDeny, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

// A part whose extended name decodes to nothing but whose plain name is a
// real file name is still an upload of that file, not a form field.
func TestSec_Filename_EmptyExtendedFallsBackToPlain(t *testing.T) {
	dir := t.TempDir()
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="shell.php"; filename*=utf-8''`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+vtestFileDeny, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

// A percent-encoded extended name is decoded before rules see it.
func TestSec_Filename_PercentEncodedExtended(t *testing.T) {
	dir := t.TempDir()
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="holiday.jpg"; filename*=iso-8859-1''%73hell.php`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+vtestFileDeny, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

// vtestAmbiguousDeny accepts either closing route for a part whose declared
// names cannot be interpreted consistently: the downstream reading becomes
// visible to rules, or the request is reported malformed.
const vtestAmbiguousDeny = `
SecRule FILES "@rx shell\.php$" "id:7002,phase:2,deny,status:403,log,msg:'blocked upload name'"
SecRule MULTIPART_STRICT_ERROR "!@eq 0" "id:7003,phase:2,deny,status:403,log,msg:'malformed multipart'"
`

// An RFC 2231 numbered continuation alongside a bare extended name names the
// same uploaded part; a backend may resolve the continuation instead.
func TestSec_Filename_ContinuationAlongsideExtended(t *testing.T) {
	dir := t.TempDir()
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="holiday.jpg"; filename*=iso-8859-1''x.jpg; filename*0*=iso-8859-1''shell.php`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+vtestAmbiguousDeny, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

// A continuation with no bare extended name at all names the part too.
func TestSec_Filename_ContinuationOnly(t *testing.T) {
	dir := t.TempDir()
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="holiday.jpg"; filename*0*=iso-8859-1''shell.php`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+vtestAmbiguousDeny, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

// An extended name that does not have the required shape cannot be resolved
// consistently.
func TestSec_Filename_MalformedExtended(t *testing.T) {
	dir := t.TempDir()
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="holiday.jpg"; filename*=iso-8859-1'shell.php`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+vtestAmbiguousDeny, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

// Two different plain names for the same part leave the effective name open.
func TestSec_Filename_DuplicatePlain(t *testing.T) {
	dir := t.TempDir()
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename="holiday.jpg"; filename="shell.php"`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+vtestAmbiguousDeny, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}
