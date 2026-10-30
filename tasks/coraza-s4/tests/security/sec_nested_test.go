// Copyright 2022 Juan Pablo Tosso and the OWASP Coraza contributors
// SPDX-License-Identifier: Apache-2.0

package vtesting

import "testing"

func vtestNestedBody(innerLines []string, data string) string {
	inner := vtestPartB(vtestInnerBoundary, innerLines, data) + "--" + vtestInnerBoundary + "--\r\n"
	return vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="bundle"`,
		`Content-Type: multipart/mixed; boundary=vtestinner`,
	}, inner))
}

// A file carried inside a part that is itself a multipart body is an uploaded
// part too: its names must reach rules like any other part's.
func TestSec_NestedPart_DecoyPlainRealExtended(t *testing.T) {
	dir := t.TempDir()
	body := vtestNestedBody([]string{
		`Content-Disposition: attachment; name="inner"; filename="holiday.jpg"; filename*=iso-8859-1''shell.php`,
		`Content-Type: image/jpeg`,
	}, "DATA")
	r := vtestRun(t, vtestBase(dir)+vtestFileDeny, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

func TestSec_NestedPart_ContinuationOnly(t *testing.T) {
	dir := t.TempDir()
	body := vtestNestedBody([]string{
		`Content-Disposition: attachment; name="inner"; filename="holiday.jpg"; filename*0*=iso-8859-1''shell.php`,
		`Content-Type: image/jpeg`,
	}, "DATA")
	r := vtestRun(t, vtestBase(dir)+vtestAmbiguousDeny, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}
