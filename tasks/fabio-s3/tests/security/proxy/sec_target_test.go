package proxy_test

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/fabiolb/fabio/config"
	"github.com/fabiolb/fabio/route"
)

// Values the proxy adds for a target from configuration must survive a client
// naming that value in its Connection header.
func TestSecConfiguredTargetHeaderCannotBeSuppressed(t *testing.T) {
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

	hGet(t, px.Client(), px.URL, []string{"x-edge-tag"}, nil)

	if got, want := sink.header().Get("X-Edge-Tag"), "alpha"; got != want {
		t.Fatalf("the backend received configured value %q, want %q", got, want)
	}
}
