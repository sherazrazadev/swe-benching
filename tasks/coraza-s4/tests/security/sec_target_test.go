// Copyright 2022 Juan Pablo Tosso and the OWASP Coraza contributors
// SPDX-License-Identifier: Apache-2.0

package vtesting

import "testing"

// A policy written against the multipart-specific uploaded-name target must
// see exactly what a policy written against the general uploaded-file target
// sees.
func TestSec_MultipartFilenameTarget_DecoyPlainRealExtended(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule MULTIPART_FILENAME "@rx shell\.php$" "id:7101,phase:2,deny,status:403,log,msg:'blocked upload name'"
`
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, vtestDecoyBody())
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

func TestSec_MultipartFilenameTarget_ExtendedOnly(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule MULTIPART_FILENAME "@rx shell\.php$" "id:7102,phase:2,deny,status:403,log,msg:'blocked upload name'"
`
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="attachment"; filename*=iso-8859-1''shell.php`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}
