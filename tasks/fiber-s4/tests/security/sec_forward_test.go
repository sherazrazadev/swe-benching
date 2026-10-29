package vtests

import (
	"testing"

	"github.com/gofiber/fiber/v3/middleware/proxy"
)

// The single-target forwarder must not pass a caller-supplied client address
// to the upstream.

func TestSec_Forward_SingleValue(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.Forward(upstream), request{
		realIP: []string{"203.0.113.7"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7"})
}

func TestSec_Forward_RepeatedHeaderLines(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.Forward(upstream), request{
		realIP: []string{"203.0.113.7", "198.51.100.9"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7", "198.51.100.9"})
}
