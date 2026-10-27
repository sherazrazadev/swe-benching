package proxy_test

import "testing"

// The service forwards normally with no client instructions and delivers the
// values it is configured to add.
func TestFunServiceConfigurationKeepsWorking(t *testing.T) {
	sink := &hSink{}
	up := sink.server(t)
	addr := hStartFabio(t, up.URL,
		"-proxy.header.clientip", "X-Trusted-Client",
		"-proxy.header.requestid", "X-Trace-Id")

	resp := hGetAddr(t, addr, nil, nil)
	if resp.StatusCode != 200 {
		t.Fatalf("the service did not forward the request: status %d", resp.StatusCode)
	}

	hdr := sink.header()
	if got, want := hdr.Get("X-Trusted-Client"), "127.0.0.1"; got != want {
		t.Errorf("the backend received client address %q, want %q", got, want)
	}
	if got := hdr.Get("X-Trace-Id"); len(got) != 36 {
		t.Errorf("the backend received request id %q, want a 36 character id", got)
	}
}
