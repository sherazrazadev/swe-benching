package proxy_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/fabiolb/fabio/config"
	"github.com/fabiolb/fabio/route"
)

// A value configured for a target reaches the backend when the client does not
// name it, and connection-scoped headers are still removed.
func TestFunConfiguredTargetValueKeepsWorking(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)

	tbl, err := route.NewTable(bytes.NewBufferString("route add svc / " + up.URL + ` opts "header=X-Edge-Tag:alpha"`))
	if err != nil {
		t.Fatalf("build routing table: %v", err)
	}
	lookup := func(r *http.Request) *route.Target {
		return tbl.Lookup(r, route.Picker["rr"], route.Matcher["prefix"], route.NewGlobCache(64), false)
	}
	px := hProxy(t, config.Proxy{}, lookup, false)

	hGet(t, px.Client(), px.URL, []string{"legit-header1"}, map[string]string{"Legit-Header1": "asdf"})

	hdr := sink.header()
	if got, want := hdr.Get("X-Edge-Tag"), "alpha"; got != want {
		t.Errorf("configured value %q, want %q", got, want)
	}
	if got := hdr.Get("Legit-Header1"); got != "" {
		t.Errorf("connection-scoped header reached the backend with %q", got)
	}
}
