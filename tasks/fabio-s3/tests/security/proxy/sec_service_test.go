package proxy_test

import "testing"

// The service's own configuration path must be protected, not only a proxy
// constructed by another program.
func TestSecServiceConfigurationIsProtected(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	addr := hStartFabio(t, up.URL,
		"-proxy.header.clientip", "X-Trusted-Client",
		"-proxy.header.requestid", "X-Trace-Id")

	hGetAddr(t, addr, []string{"close, x-trusted-client, x-trace-id"}, nil)

	hdr := sink.header()
	if got, want := hdr.Get("X-Trusted-Client"), "127.0.0.1"; got != want {
		t.Errorf("the backend received client address %q, want %q", got, want)
	}
	if got := hdr.Get("X-Trace-Id"); len(got) != 36 {
		t.Errorf("the backend received request id %q, want a 36 character id", got)
	}
}
