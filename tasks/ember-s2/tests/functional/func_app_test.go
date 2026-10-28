package app

import (
	"bytes"
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/alexandre-daubois/ember/internal/fetcher"
	"github.com/alexandre-daubois/ember/internal/model"
)

const funcAppEvil = "\x1b]0;ZQPWN\x07"

// TestFunctionalJSONKeepsRawValues proves the machine-readable output still
// carries the values exactly as they arrived: JSON escapes them on the wire,
// but the decoded strings are untouched.
func TestFunctionalJSONKeepsRawValues(t *testing.T) {
	evilHost := "h" + funcAppEvil + "ost"
	evilURI := "/u?" + funcAppEvil
	evilMethod := "M" + funcAppEvil
	snap := &fetcher.Snapshot{
		FetchedAt: time.Now(),
		Metrics: fetcher.MetricsSnapshot{
			HasHTTPMetrics: true,
			Hosts: map[string]*fetcher.HostMetrics{
				evilHost: {Host: evilHost, RequestsTotal: 3},
			},
		},
		Threads: fetcher.ThreadsResponse{ThreadDebugStates: []fetcher.ThreadDebugState{{
			Index:         0,
			IsBusy:        true,
			CurrentURI:    evilURI,
			CurrentMethod: evilMethod,
		}}},
	}
	var st model.State
	st.Update(snap)
	out := buildJSONOutput(snap, &st)

	body, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if bytes.Contains(body, []byte("\x1b")) {
		t.Fatalf("JSON output contains a raw ESC byte; it must be JSON-escaped on the wire")
	}

	var decoded struct {
		Hosts []struct {
			Host string `json:"host"`
		} `json:"hosts"`
		Threads struct {
			ThreadDebugStates []struct {
				CurrentURI    string `json:"currentUri"`
				CurrentMethod string `json:"currentMethod"`
			} `json:"threadDebugStates"`
		} `json:"threads"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(decoded.Hosts) != 1 || decoded.Hosts[0].Host != evilHost {
		t.Fatalf("JSON host value was altered: %+v, want %q", decoded.Hosts, evilHost)
	}
	if len(decoded.Threads.ThreadDebugStates) != 1 {
		t.Fatalf("thread state missing from JSON output")
	}
	th := decoded.Threads.ThreadDebugStates[0]
	if th.CurrentURI != evilURI || th.CurrentMethod != evilMethod {
		t.Fatalf("JSON thread values were altered: uri=%q method=%q", th.CurrentURI, th.CurrentMethod)
	}
}

// TestFunctionalDiffCleanReport keeps the non-interactive report correct for a
// legitimate host and ordinary numbers.
func TestFunctionalDiffCleanReport(t *testing.T) {
	dir := t.TempDir()
	hosts := []jsonHost{{Host: "shop.example.com", RPS: 10, AvgTime: 2}}
	before := writeSecSnapshot(t, dir, "before.json", hosts, 2)
	after := writeSecSnapshot(t, dir, "after.json", hosts, 1)

	var buf bytes.Buffer
	cmd := newDiffCmd(&config{})
	cmd.SetArgs([]string{before, after})
	cmd.SetOut(&buf)
	cmd.SetErr(&buf)
	if err := cmd.Execute(); err != nil {
		t.Fatalf("clean diff should not report a regression: %v\n%s", err, buf.String())
	}
	out := buf.String()
	for _, want := range []string{"Per-host changes", "shop.example.com", "In-flight", "2.0 -> 1.0"} {
		if !strings.Contains(out, want) {
			t.Fatalf("clean diff report lost %q:\n%s", want, out)
		}
	}
}

// TestFunctionalSnapshotRoundTripKeepsControls proves the snapshot file
// itself preserves the value: writing and re-reading the per-host label gives
// back the same bytes the metrics carried.
func TestFunctionalSnapshotRoundTripKeepsControls(t *testing.T) {
	dir := t.TempDir()
	evilHost := "h" + funcAppEvil + "ost"
	path := writeSecSnapshot(t, dir, "s.json", []jsonHost{{Host: evilHost, RPS: 1}}, 0)
	snaps, err := loadSnapshots(filepath.Clean(path))
	if err != nil {
		t.Fatalf("load snapshot: %v", err)
	}
	got := snaps[""]
	if len(got.Hosts) != 1 || got.Hosts[0].Host != evilHost {
		t.Fatalf("snapshot round trip altered the host label: %+v", got.Hosts)
	}
}
