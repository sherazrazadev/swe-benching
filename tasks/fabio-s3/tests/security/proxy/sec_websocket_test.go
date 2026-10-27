package proxy_test

import (
	"strings"
	"testing"

	"github.com/fabiolb/fabio/config"
)

// A websocket handshake is written to the backend by its own path. The values
// the proxy adds to that handshake must arrive there too.
func TestSecWebsocketHandshakeKeepsAddedValues(t *testing.T) {
	sink, backend := hNewRawSink(t)
	px := hProxy(t, config.Proxy{ClientIPHeader: "X-Trusted-Client"}, hLookup("http://"+backend), false)

	hRawHandshake(t, strings.TrimPrefix(px.URL, "http://"),
		[]string{"upgrade, x-trusted-client, x-forwarded-for"}, nil)

	hdr := sink.next(t)
	if got, want := hdr.Get("Upgrade"), "websocket"; got != want {
		t.Errorf("the backend received upgrade %q, want %q", got, want)
	}
	if got, want := hdr.Get("X-Trusted-Client"), "127.0.0.1"; got != want {
		t.Errorf("the backend received client address %q, want %q", got, want)
	}
	if got := hdr.Get("X-Forwarded-For"); !strings.Contains(got, "127.0.0.1") {
		t.Errorf("the backend received forwarded-for %q, want it to contain the client address", got)
	}
}
