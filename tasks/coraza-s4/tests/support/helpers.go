// Copyright 2022 Juan Pablo Tosso and the OWASP Coraza contributors
// SPDX-License-Identifier: Apache-2.0

package vtesting

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/corazawaf/coraza/v3"
)

// vtestResult is what one processed request produced.
type vtestResult struct {
	Interrupted bool
	Status      int
	Matched     []int
}

func (r vtestResult) matched(id int) bool {
	for _, m := range r.Matched {
		if m == id {
			return true
		}
	}
	return false
}

// vtestBase is the engine configuration every case starts from. The upload
// directory is supplied by the test so any retained artefact is observable.
func vtestBase(uploadDir string) string {
	return fmt.Sprintf(`
SecRuleEngine On
SecRequestBodyAccess On
SecRequestBodyLimit 1048576
SecUploadDir %s
`, uploadDir)
}

// vtestRun drives one request through the public request-processing API and
// returns what the rule engine did with it.
func vtestRun(t *testing.T, directives, contentType, body string) vtestResult {
	t.Helper()
	waf, err := coraza.NewWAF(coraza.NewWAFConfig().WithDirectives(directives))
	if err != nil {
		t.Fatalf("building the engine: %v", err)
	}
	tx := waf.NewTransaction()
	defer func() {
		if err := tx.Close(); err != nil {
			t.Fatalf("closing the transaction: %v", err)
		}
	}()
	tx.ProcessURI("/upload", "POST", "HTTP/1.1")
	tx.AddRequestHeader("Content-Type", contentType)
	tx.AddRequestHeader("Content-Length", fmt.Sprintf("%d", len(body)))
	if it := tx.ProcessRequestHeaders(); it != nil {
		return vtestResult{Interrupted: true, Status: it.Status}
	}
	if _, _, err := tx.WriteRequestBody([]byte(body)); err != nil {
		t.Fatalf("writing the request body: %v", err)
	}
	it, err := tx.ProcessRequestBody()
	if err != nil {
		t.Fatalf("processing the request body: %v", err)
	}
	var matched []int
	for _, m := range tx.MatchedRules() {
		matched = append(matched, m.Rule().ID())
	}
	if it != nil {
		return vtestResult{Interrupted: true, Status: it.Status, Matched: matched}
	}
	return vtestResult{Matched: matched}
}

// vtestPartB renders one part of a body using the given boundary.
func vtestPartB(boundary string, lines []string, data string) string {
	var b strings.Builder
	b.WriteString("--" + boundary + "\r\n")
	for _, l := range lines {
		b.WriteString(l)
		b.WriteString("\r\n")
	}
	b.WriteString("\r\n")
	b.WriteString(data)
	b.WriteString("\r\n")
	return b.String()
}

const (
	vtestBoundary      = "vtestboundary"
	vtestInnerBoundary = "vtestinner"
	vtestContentType   = "multipart/form-data; boundary=vtestboundary"
)

// vtestPart renders one part of the outer body.
func vtestPart(lines []string, data string) string {
	return vtestPartB(vtestBoundary, lines, data)
}

// vtestBody closes a body built from vtestPart pieces.
func vtestBody(parts ...string) string {
	return strings.Join(parts, "") + "--" + vtestBoundary + "--\r\n"
}

// vtestNoRetainedUpload fails when the engine kept an uploaded file behind.
func vtestNoRetainedUpload(t *testing.T, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("reading the upload directory: %v", err)
	}
	if len(entries) != 0 {
		var names []string
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Fatalf("the engine retained uploaded files after the transaction: %v", names)
	}
}

// vtestRequireBlocked asserts a clean client-side refusal. It deliberately does
// not demand one particular status code.
func vtestRequireBlocked(t *testing.T, r vtestResult) {
	t.Helper()
	if !r.Interrupted {
		t.Fatalf("the request was accepted: no rule matched the upload name")
	}
	if r.Status < 400 || r.Status >= 500 {
		t.Fatalf("the refusal was not a client error (status %d)", r.Status)
	}
}

// vtestRequireAccepted asserts the engine let an ordinary request through.
func vtestRequireAccepted(t *testing.T, r vtestResult) {
	t.Helper()
	if r.Interrupted {
		t.Fatalf("an ordinary request was refused with status %d", r.Status)
	}
}
