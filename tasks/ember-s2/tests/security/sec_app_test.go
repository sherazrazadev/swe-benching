package app

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/alexandre-daubois/ember/internal/fetcher"
)

const (
	secAppMarker  = "ZQPWN"
	secAppPayload = secAppMarker + "\x1b]0;" + secAppMarker + "\x07\x1b[2J"
)

// writeSecSnapshot writes one snapshot in the format `ember --json --once`
// produces. json.Marshal escapes the control bytes on the way to disk; the
// loader decodes them back into the raw string the report prints.
func writeSecSnapshot(t *testing.T, dir, name string, hosts []jsonHost, inFlight float64) string {
	t.Helper()
	out := jsonOutput{
		Hosts:     hosts,
		Process:   fetcher.ProcessMetrics{},
		FetchedAt: time.Now(),
	}
	for i := range out.Hosts {
		out.Hosts[i].InFlight = inFlight
	}
	body, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("marshal snapshot: %v", err)
	}
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, body, 0o600); err != nil {
		t.Fatalf("write snapshot: %v", err)
	}
	return path
}

// TestSecurityDiffReport drives the real `diff` command over two snapshots
// whose per-host label carries terminal escape sequences. The label is the
// per-host metric name, ultimately the request Host header.
func TestSecurityDiffReport(t *testing.T) {
	dir := t.TempDir()
	hosts := []jsonHost{{Host: secAppPayload, RPS: 1, AvgTime: 1}}
	before := writeSecSnapshot(t, dir, "before.json", hosts, 2)
	after := writeSecSnapshot(t, dir, "after.json", hosts, 1)

	var buf bytes.Buffer
	cmd := newDiffCmd(&config{})
	cmd.SetArgs([]string{before, after})
	cmd.SetOut(&buf)
	cmd.SetErr(&buf)
	if err := cmd.Execute(); err != nil {
		// A regression verdict is fine; the render is what this test reads.
		t.Logf("diff exit: %v", err)
	}

	out := buf.String()
	for _, bad := range []string{"\x07", "\x1b]", "\x1b[2J"} {
		if strings.Contains(out, bad) {
			t.Fatalf("per-host name from a snapshot reached stdout with a terminal control sequence %q:\n%s", bad, out)
		}
	}
	if !strings.Contains(out, secAppMarker) {
		t.Fatalf("the per-host name was not printed at all (the test would pass for the wrong reason):\n%s", out)
	}
}

// TestSecurityDiffControlShapes covers the control classes a plain text
// report passes through unchanged: carriage return, tab, NUL, DEL and C1
// code points supplied as UTF-8.
func TestSecurityDiffControlShapes(t *testing.T) {
	cases := map[string]string{
		"CR":     "h\r" + secAppMarker + "ost",
		"TAB":    "h\t" + secAppMarker + "ost",
		"NUL":    "h\x00" + secAppMarker + "ost",
		"DEL":    "h\x7f" + secAppMarker + "ost",
		"C1 OSC": "h\u009d0;" + secAppMarker + "\u009cost",
		"C1 CSI": "h\u009b2J" + secAppMarker + "ost",
	}
	for name, host := range cases {
		t.Run(name, func(t *testing.T) {
			dir := t.TempDir()
			hosts := []jsonHost{{Host: host, RPS: 1, AvgTime: 1}}
			before := writeSecSnapshot(t, dir, "before.json", hosts, 2)
			after := writeSecSnapshot(t, dir, "after.json", hosts, 1)
			var buf bytes.Buffer
			cmd := newDiffCmd(&config{})
			cmd.SetArgs([]string{before, after})
			cmd.SetOut(&buf)
			cmd.SetErr(&buf)
			_ = cmd.Execute()
			out := buf.String()
			for _, bad := range []string{"\r", "\t", "\x00", "\x7f", string(rune(0x9b)), string(rune(0x9d)), string(rune(0x9c))} {
				if strings.Contains(out, bad) {
					t.Fatalf("%s: control %q reached stdout:\n%s", name, bad, out)
				}
			}
			if !strings.Contains(out, secAppMarker) {
				t.Fatalf("%s: the printable remainder is missing:\n%s", name, out)
			}
		})
	}
}
