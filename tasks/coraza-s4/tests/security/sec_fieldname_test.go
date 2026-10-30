// Copyright 2022 Juan Pablo Tosso and the OWASP Coraza contributors
// SPDX-License-Identifier: Apache-2.0

package vtesting

import "testing"

// A policy keyed on the name a form field is submitted under must see every
// name the receiving application may key it by.
func TestSec_FieldName_FormField(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule ARGS_POST:evil "@rx attack-marker" "id:7201,phase:2,deny,status:403,log,msg:'blocked field name'"
`
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="feedback"; name*=iso-8859-1''evil`,
	}, "attack-marker"))
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}

// The same applies to the name under which a file part is submitted.
func TestSec_FieldName_FilePart(t *testing.T) {
	dir := t.TempDir()
	const rules = `
SecRule FILES_NAMES "@rx ^evil$" "id:7202,phase:2,deny,status:403,log,msg:'blocked field name'"
`
	body := vtestBody(vtestPart([]string{
		`Content-Disposition: form-data; name="feedback"; name*=iso-8859-1''evil; filename="holiday.jpg"`,
		`Content-Type: image/jpeg`,
	}, "DATA"))
	r := vtestRun(t, vtestBase(dir)+rules, vtestContentType, body)
	vtestRequireBlocked(t, r)
	vtestNoRetainedUpload(t, dir)
}
