package proxy_test

import (
	"strings"
	"testing"

	"github.com/fabiolb/fabio/config"
)

// A websocket handshake keeps completing, the upgrade information still
// reaches the backend, connection-scoped headers are still removed, and the
// values the proxy adds are present.
func TestFunWebsocketHandshakeKeepsWorking(t *testing.T) {
	sink, backend := hNewRawSink(t)
	px := hProxy(t, config.Proxy{ClientIPHeader: "X-Trusted-Client"}, hLookup("http://"+backend), false)

	hRawHandshake(t, strings.TrimPrefix(px.URL, "http://"),
		[]string{"upgrade, legit-header1"}, map[string]string{"Legit-Header1": "asdf"})

	hdr := sink.next(t)
	if got, want := hdr.Get("Upgrade"), "websocket"; got != want {
		t.Errorf("the backend received upgrade %q, want %q", got, want)
	}
	if got := hdr.Get("Legit-Header1"); got != "" {
		t.Errorf("connection-scoped header reached the backend with %q", got)
	}
	if got, want := hdr.Get("X-Trusted-Client"), "127.0.0.1"; got != want {
		t.Errorf("client address %q, want %q", got, want)
	}
}
