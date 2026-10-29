package vtests

import (
	"testing"

	"github.com/gofiber/fiber/v3/middleware/proxy"
)

// The configurable load balancer must not pass a caller-supplied client
// address to the upstream.

func TestSec_Balancer_SingleValue(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.Balancer(proxy.Config{Servers: []string{upstream}}), request{
		realIP: []string{"203.0.113.7"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7"})
}

func TestSec_Balancer_RepeatedHeaderLines(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.Balancer(proxy.Config{Servers: []string{upstream}}), request{
		realIP: []string{"203.0.113.7", "198.51.100.9"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7", "198.51.100.9"})
}

func TestSec_Balancer_CommaSeparatedList(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.Balancer(proxy.Config{Servers: []string{upstream}}), request{
		realIP: []string{"203.0.113.7, 198.51.100.9"},
	})
	requireDeliveredObservedAddress(t, got, status, []string{"203.0.113.7, 198.51.100.9"})
}

func TestSec_Balancer_EmptyValue(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.Balancer(proxy.Config{Servers: []string{upstream}}), request{
		realIP: []string{""},
	})
	requireDeliveredObservedAddress(t, got, status, []string{""})
}
