package vtests

import (
	"testing"

	"github.com/gofiber/fiber/v3/middleware/proxy"
)

// The round-robin forwarder must not pass a caller-supplied client address to
// the upstream, in any of the forms a caller can supply it.

func TestSec_BalancerForward_SingleValue(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.BalancerForward([]string{upstream}), request{
		realIP: []string{"203.0.113.7"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7"})
}

func TestSec_BalancerForward_RepeatedHeaderLines(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.BalancerForward([]string{upstream}), request{
		realIP: []string{"203.0.113.7", "198.51.100.9"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7", "198.51.100.9"})
}

func TestSec_BalancerForward_CommaSeparatedList(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.BalancerForward([]string{upstream}), request{
		realIP: []string{"203.0.113.7, 198.51.100.9"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7, 198.51.100.9"})
}

func TestSec_BalancerForward_EmptyValue(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.BalancerForward([]string{upstream}), request{
		realIP: []string{""},
	})
	requireDeliveredObservedAddress(t, got, status, []string{""})
}
