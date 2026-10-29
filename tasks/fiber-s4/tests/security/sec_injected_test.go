package vtests

import (
	"testing"

	"github.com/gofiber/fiber/v3/middleware/proxy"
)

// A forwarding path that prepares its own outbound message must still deliver
// only the address the proxy observed, and must not take the address from a
// caller-supplied header.

func TestSec_PrefixForward_SingleValue(t *testing.T) {
	upstream := startUpstream(t)
	handler := proxy.PrefixForward("/api", "", upstream)
	got, status := drive(t, handler, request{
		path:   "/api/thing",
		realIP: []string{"203.0.113.7"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7"})
}

func TestSec_ForwardedForForward_ClientChainNotTrusted(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.ForwardedForForward(upstream), request{
		realIP: []string{"203.0.113.7"},
		headers: map[string]string{
			"X-Forwarded-For": "198.51.100.9, 192.0.2.1",
		},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7", "198.51.100.9"})
}
