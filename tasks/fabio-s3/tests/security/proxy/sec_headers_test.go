package proxy_test

import (
	"net/http"
	"testing"

	"github.com/fabiolb/fabio/config"
)

// A configured client-address header must survive a client naming it in the
// Connection header. The configured name is lower case, as an operator may
// write it; the client sends it in another case.
func TestSecClientIPHeaderCannotBeSuppressed(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	px := hProxy(t, config.Proxy{ClientIPHeader: "x-trusted-client"}, hLookup(up.URL), false)

	resp := hGet(t, px.Client(), px.URL, []string{"close, x-trusted-client"}, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("the proxy did not forward the request: status %d", resp.StatusCode)
	}
	if got, want := sink.header().Get("X-Trusted-Client"), "127.0.0.1"; got != want {
		t.Fatalf("the backend received client address %q, want %q", got, want)
	}
}

// A request identifier must survive a Connection line that mixes it with
// legitimate connection-scoped names and other forwarding headers.
func TestSecRequestIDSurvivesMixedConnectionTokens(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	px := hProxy(t, config.Proxy{RequestID: "X-Trace-Id"}, hLookup(up.URL), false)

	hGet(t, px.Client(), px.URL,
		[]string{"keep-alive, x-trace-id, x-forwarded-for, legit-header1, legit-header2"},
		map[string]string{"Legit-Header1": "asdf", "Legit-Header2": "qwerty"})

	if got := sink.header().Get("X-Trace-Id"); got != hUUID {
		t.Fatalf("the backend received request id %q, want %q", got, hUUID)
	}
}

// The TLS indicator must survive the same treatment on an encrypted listener.
func TestSecTLSHeaderCannotBeSuppressed(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	px := hProxy(t, config.Proxy{TLSHeader: "X-Conn-Secure", TLSHeaderValue: "on"}, hLookup(up.URL), true)

	hGet(t, px.Client(), px.URL, []string{"x-conn-secure"}, nil)

	if got, want := sink.header().Get("X-Conn-Secure"), "on"; got != want {
		t.Fatalf("the backend received TLS indicator %q, want %q", got, want)
	}
}

// A proxy built by an embedding program gets the same protection: configured
// values and the values the proxy always adds must all arrive.
func TestSecEmbeddedProxyProtectsItsValues(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	px := hProxy(t, config.Proxy{ClientIPHeader: "X-Trusted-Client", RequestID: "X-Trace-Id"}, hLookup(up.URL), false)

	hGet(t, px.Client(), px.URL, []string{"close, x-trusted-client, x-trace-id, x-forwarded-host"}, nil)

	hdr := sink.header()
	if got, want := hdr.Get("X-Trusted-Client"), "127.0.0.1"; got != want {
		t.Errorf("client address %q, want %q", got, want)
	}
	if got := hdr.Get("X-Trace-Id"); got != hUUID {
		t.Errorf("request id %q, want %q", got, hUUID)
	}
	if got, want := hdr.Get("X-Forwarded-Host"), "svc.example"; got != want {
		t.Errorf("forwarded host %q, want %q", got, want)
	}
}

// Several Connection lines must not add up to a suppression.
func TestSecMultipleConnectionLines(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	px := hProxy(t, config.Proxy{ClientIPHeader: "X-Trusted-Client"}, hLookup(up.URL), false)

	hGet(t, px.Client(), px.URL,
		[]string{"keep-alive, x-trusted-client", "x-real-ip, x-forwarded-proto"}, nil)

	hdr := sink.header()
	if got, want := hdr.Get("X-Trusted-Client"), "127.0.0.1"; got != want {
		t.Errorf("client address %q, want %q", got, want)
	}
	if got, want := hdr.Get("X-Real-Ip"), "127.0.0.1"; got != want {
		t.Errorf("real ip %q, want %q", got, want)
	}
	if got, want := hdr.Get("X-Forwarded-Proto"), "http"; got != want {
		t.Errorf("forwarded proto %q, want %q", got, want)
	}
}
