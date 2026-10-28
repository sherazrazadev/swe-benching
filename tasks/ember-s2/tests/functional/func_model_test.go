package model

import (
	"strings"
	"testing"
	"time"

	"github.com/alexandre-daubois/ember/internal/fetcher"
)

const (
	funcModelMarker = "ZQPWN"
	funcModelEvil   = "\x1b]0;" + funcModelMarker + "\x07"
)

// TestFunctionalRouteKeysKeepRawValues proves route aggregation still groups
// by, and reports, the values exactly as they arrived. Cleaning at ingest
// would merge or split buckets and change what the By Route view shows.
func TestFunctionalRouteKeysKeepRawValues(t *testing.T) {
	rawHost := "h" + funcModelEvil + "ost"
	rawMethod := "M" + funcModelEvil
	rawURI := "/orders/" + funcModelEvil + "/abc"

	if got := NormalizeURI(rawURI); got != rawURI {
		t.Fatalf("NormalizeURI altered a raw path: %q, want %q", got, rawURI)
	}

	agg := NewRouteAggregator()
	entry := fetcher.LogEntry{
		Timestamp: time.Now(),
		Logger:    "http.log.access.log0",
		Host:      rawHost,
		Method:    rawMethod,
		URI:       rawURI,
		Status:    200,
	}
	agg.Track(entry)
	agg.Track(entry)

	if n := agg.BucketCount(); n != 1 {
		t.Fatalf("two identical requests made %d buckets, want 1", n)
	}
	stats := agg.Snapshot()
	if len(stats) != 1 {
		t.Fatalf("snapshot has %d rows, want 1", len(stats))
	}
	k := stats[0].Key
	if k.Host != rawHost || k.Method != rawMethod || k.Pattern != rawURI {
		t.Fatalf("route key changed: host=%q method=%q pattern=%q", k.Host, k.Method, k.Pattern)
	}
	if !strings.Contains(k.Pattern, funcModelEvil) {
		t.Fatalf("route pattern lost the raw control bytes: %q", k.Pattern)
	}
}
