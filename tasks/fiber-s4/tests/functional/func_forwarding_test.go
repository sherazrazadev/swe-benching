package vtests

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/proxy"
)

// Ordinary proxying keeps working: the request reaches the upstream and the
// upstream's response comes back to the caller.

func TestFunc_BalancerForward_ForwardsRequestAndResponse(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.BalancerForward([]string{upstream}), request{
		path:    "/orders/7?expand=items",
		headers: map[string]string{"X-Custom": "kept"},
	})
	if status != fiber.StatusOK {
		t.Fatalf("status %d; want 200", status)
	}
	if got == nil {
		t.Fatalf("the upstream response was not returned")
	}
	if got.Path != "/orders/7" || got.Query != "expand=items" {
		t.Fatalf("upstream saw path %q query %q; want /orders/7 and expand=items", got.Path, got.Query)
	}
	if got.Custom != "kept" {
		t.Fatalf("upstream saw X-Custom %q; want kept", got.Custom)
	}
}

// The forwarded request must still carry the address the proxy observed when
// the caller supplied none of its own.
func TestFunc_BalancerForward_DeliversObservedAddress(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.BalancerForward([]string{upstream}), request{})
	if status != fiber.StatusOK {
		t.Fatalf("status %d; want 200", status)
	}
	if got == nil || len(got.RealIP) != 1 || got.RealIP[0] != observedAddress {
		t.Fatalf("upstream received client addresses %v; want [%s]", realIP(got), observedAddress)
	}
}

// A request that carries a client address header is still served; the proxy
// must not turn it into an error.
func TestFunc_BalancerForward_ServesRequestWithClientHeader(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.BalancerForward([]string{upstream}), request{
		path:   "/orders/7",
		realIP: []string{"203.0.113.7"},
	})
	if status != fiber.StatusOK {
		t.Fatalf("a request carrying the client address header returned status %d; the proxy must still serve it", status)
	}
	if got == nil || got.Path != "/orders/7" {
		t.Fatalf("the request was not forwarded")
	}
}

func TestFunc_Balancer_ForwardsRequestAndResponse(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.Balancer(proxy.Config{Servers: []string{upstream}}), request{
		path:    "/orders/7?expand=items",
		headers: map[string]string{"X-Custom": "kept"},
	})
	if status != fiber.StatusOK {
		t.Fatalf("status %d; want 200", status)
	}
	if got == nil {
		t.Fatalf("the upstream response was not returned")
	}
	if got.Path != "/orders/7" || got.Query != "expand=items" || got.Custom != "kept" {
		t.Fatalf("upstream saw path %q query %q X-Custom %q; want the request unchanged", got.Path, got.Query, got.Custom)
	}
}

// A value the application places on the outgoing request is authoritative.
func TestFunc_Balancer_ApplicationReportedValueIsAuthoritative(t *testing.T) {
	upstream := startUpstream(t)
	handler := proxy.Balancer(proxy.Config{
		Servers: []string{upstream},
		ModifyRequest: func(c fiber.Ctx) error {
			c.Request().Header.Set("X-Real-IP", "203.0.113.9")
			c.Request().Header.Set("X-Custom", "tenant-a")
			return nil
		},
	})
	got, status := drive(t, handler, request{realIP: []string{"203.0.113.7"}})
	if status != fiber.StatusOK {
		t.Fatalf("status %d; want 200", status)
	}
	if got == nil || len(got.RealIP) != 1 || got.RealIP[0] != "203.0.113.9" {
		t.Fatalf("upstream received client addresses %v; want the value the application set", realIP(got))
	}
	if got.Custom != "tenant-a" {
		t.Fatalf("upstream saw X-Custom %q; want tenant-a", got.Custom)
	}
}

func TestFunc_Forward_ForwardsRequestAndResponse(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.Forward(upstream), request{
		path:    "/orders/7?expand=items",
		headers: map[string]string{"X-Custom": "kept"},
	})
	if status != fiber.StatusOK {
		t.Fatalf("status %d; want 200", status)
	}
	if got == nil || got.Custom != "kept" {
		t.Fatalf("upstream saw %+v; want the request forwarded with its headers", got)
	}
}

func TestFunc_DomainForward_MatchingHostForwards(t *testing.T) {
	upstream := startUpstream(t)
	handler := proxy.DomainForward("svc.example", upstream)
	got, status := drive(t, handler, request{host: "svc.example", path: "/orders/7?expand=items"})
	if status != fiber.StatusOK {
		t.Fatalf("status %d; want 200", status)
	}
	if got == nil || got.Path != "/orders/7" || got.Query != "expand=items" {
		t.Fatalf("upstream saw %+v; want /orders/7?expand=items", got)
	}
}

func TestFunc_DomainForward_OtherHostNotForwarded(t *testing.T) {
	upstream := startUpstream(t)

	app := fiber.New()
	app.Use(proxy.DomainForward("svc.example", upstream))

	resp, err := app.Test(httptest.NewRequest(fiber.MethodGet, "/", nil))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close() //nolint:errcheck // test cleanup
	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("status %d; want 200", resp.StatusCode)
	}
	body := make([]byte, 64)
	n, _ := resp.Body.Read(body)
	if n != 0 {
		t.Fatalf("a request for another host was forwarded upstream: %q", string(body[:n]))
	}
}

func TestFunc_PrefixForward_RewritesPathAndKeepsRequest(t *testing.T) {
	upstream := startUpstream(t)
	handler := proxy.PrefixForward("/api", "", upstream)
	got, status := drive(t, handler, request{
		method:  fiber.MethodPost,
		path:    "/api/orders/7?expand=items",
		headers: map[string]string{"X-Custom": "kept"},
		body:    "payload",
	})
	if status != fiber.StatusOK {
		t.Fatalf("status %d; want 200", status)
	}
	if got == nil {
		t.Fatalf("the upstream response was not returned")
	}
	if got.Path != "/orders/7" || got.Query != "expand=items" {
		t.Fatalf("upstream saw path %q query %q; want /orders/7 and expand=items", got.Path, got.Query)
	}
	if got.Method != fiber.MethodPost || got.Body != "payload" || got.Custom != "kept" {
		t.Fatalf("upstream saw method %q body %q X-Custom %q; want the request preserved", got.Method, got.Body, got.Custom)
	}
}

func TestFunc_ForwardedForForward_ForwardsWithoutChain(t *testing.T) {
	upstream := startUpstream(t)
	got, status := drive(t, proxy.ForwardedForForward(upstream), request{
		path: "/orders/7?expand=items",
	})
	if status != fiber.StatusOK {
		t.Fatalf("status %d; want 200", status)
	}
	if got == nil || got.Path != "/orders/7" || got.Query != "expand=items" {
		t.Fatalf("upstream saw %+v; want the request forwarded", got)
	}
	if len(got.RealIP) != 1 || got.RealIP[0] != observedAddress {
		t.Fatalf("upstream received client addresses %v; want [%s]", got.RealIP, observedAddress)
	}
}
