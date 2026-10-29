package vtests

import (
	"testing"

	"github.com/gofiber/fiber/v3/middleware/proxy"
)

// The host-matched forwarder must not pass a caller-supplied client address to
// the upstream.

func TestSec_DomainForward_SingleValue(t *testing.T) {
	upstream := startUpstream(t)
	handler := proxy.DomainForward("svc.example", upstream)
	got, status := drive(t, handler, request{
		host:   "svc.example",
		realIP: []string{"203.0.113.7"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7"})
}

func TestSec_DomainForward_RepeatedHeaderLines(t *testing.T) {
	upstream := startUpstream(t)
	handler := proxy.DomainForward("svc.example", upstream)
	got, status := drive(t, handler, request{
		host:   "svc.example",
		realIP: []string{"203.0.113.7", "198.51.100.9"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7", "198.51.100.9"})
}
