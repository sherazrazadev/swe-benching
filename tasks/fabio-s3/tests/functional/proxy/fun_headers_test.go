package proxy_test

import (
	"net/http"
	"testing"

	"github.com/fabiolb/fabio/config"
)

// With no client instructions the configured values reach the backend and the
// proxy's own value beats a value supplied by the client.
func TestFunConfiguredValuesWithoutClientInstructions(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	px := hProxy(t, config.Proxy{ClientIPHeader: "x-trusted-client", RequestID: "X-Trace-Id"}, hLookup(up.URL), false)

	hGet(t, px.Client(), px.URL, nil, map[string]string{
		"X-Trusted-Client": "6.6.6.6",
		"X-Trace-Id":       "client-supplied",
	})

	hdr := sink.header()
	if got, want := hdr.Get("X-Trusted-Client"), "127.0.0.1"; got != want {
		t.Errorf("client address %q, want the proxy's value %q", got, want)
	}
	if got, want := hdr.Get("X-Trace-Id"), hUUID; got != want {
		t.Errorf("request id %q, want the proxy's value %q", got, want)
	}
}

// Headers the client asks to treat as connection-scoped are still removed,
// while headers the proxy adds are not.
func TestFunClientConnectionHeadersStillRemoved(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	px := hProxy(t, config.Proxy{ClientIPHeader: "X-Trusted-Client"}, hLookup(up.URL), false)

	hGet(t, px.Client(), px.URL,
		[]string{"keep-alive, legit-header1, legit-header2"},
		map[string]string{"Legit-Header1": "asdf", "Legit-Header2": "qwerty"})

	hdr := sink.header()
	if got := hdr.Get("Legit-Header1"); got != "" {
		t.Errorf("connection-scoped header reached the backend with %q", got)
	}
	if got := hdr.Get("Legit-Header2"); got != "" {
		t.Errorf("connection-scoped header reached the backend with %q", got)
	}
	if got, want := hdr.Get("X-Trusted-Client"), "127.0.0.1"; got != want {
		t.Errorf("client address %q, want %q", got, want)
	}

	// Without being named for removal the same header is forwarded normally.
	hGet(t, px.Client(), px.URL, nil, map[string]string{"Legit-Header1": "asdf"})
	if got, want := sink.header().Get("Legit-Header1"), "asdf"; got != want {
		t.Errorf("ordinary header %q, want %q", got, want)
	}
}

// The forwarding headers the proxy always adds stay protected with no extra
// configuration.
func TestFunDefaultForwardingHeaders(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	px := hProxy(t, config.Proxy{}, hLookup(up.URL), false)

	resp := hGet(t, px.Client(), px.URL,
		[]string{"x-forwarded-host, x-forwarded-for, x-real-ip"}, nil)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("the proxy did not forward the request: status %d", resp.StatusCode)
	}
	hdr := sink.header()
	if got, want := hdr.Get("X-Forwarded-Host"), "svc.example"; got != want {
		t.Errorf("forwarded host %q, want %q", got, want)
	}
	if got := hdr.Get("X-Forwarded-For"); got == "" {
		t.Errorf("forwarded-for is missing")
	}
	if got := hdr.Get("X-Real-Ip"); got == "" {
		t.Errorf("real ip is missing")
	}
}
