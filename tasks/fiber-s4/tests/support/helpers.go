package vtests

import (
	"encoding/json"
	"io"
	"net"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
)

// observedAddress is the peer address the framework reports for a request
// delivered through app.Test; it is the address every forwarding path is
// expected to place in the client-address header.
const observedAddress = "0.0.0.0"

type observed struct {
	RealIP []string `json:"real_ip"`
	Path   string   `json:"path"`
	Query  string   `json:"query"`
	Custom string   `json:"custom"`
	Body   string   `json:"body"`
	Method string   `json:"method"`
}

// startUpstream runs a backend that reports every value it received in the
// client-address header together with a few request fields.
func startUpstream(t *testing.T) string {
	t.Helper()

	app := fiber.New()
	app.Use(func(c fiber.Ctx) error {
		values := c.Request().Header.PeekAll("X-Real-IP")
		seen := make([]string, 0, len(values))
		for _, v := range values {
			seen = append(seen, string(v))
		}
		return c.JSON(observed{
			RealIP: seen,
			Path:   c.Path(),
			Query:  string(c.Request().URI().QueryString()),
			Custom: c.Get("X-Custom"),
			Body:   string(c.Body()),
			Method: c.Method(),
		})
	})

	ln, err := net.Listen(fiber.NetworkTCP4, "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen on loopback: %v", err)
	}
	go func() {
		_ = app.Listener(ln, fiber.ListenConfig{DisableStartupMessage: true})
	}()
	t.Cleanup(func() { _ = app.Shutdown() })
	return "http://" + ln.Addr().String()
}

type request struct {
	path    string
	host    string
	realIP  []string
	headers map[string]string
	body    string
	method  string
}

// drive mounts the handler and sends one request through it, returning what the
// upstream observed and the status the caller received.
func drive(t *testing.T, handler fiber.Handler, r request) (*observed, int) {
	t.Helper()

	app := fiber.New()
	app.Use(handler)

	method := r.method
	if method == "" {
		method = fiber.MethodGet
	}
	path := r.path
	if path == "" {
		path = "/"
	}
	var body io.Reader
	if r.body != "" {
		body = strings.NewReader(r.body)
	}
	req := httptest.NewRequest(method, path, body)
	if r.host != "" {
		req.Host = r.host
	}
	for _, v := range r.realIP {
		req.Header.Add("X-Real-IP", v)
	}
	for k, v := range r.headers {
		req.Header.Set(k, v)
	}

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request through the proxy: %v", err)
	}
	defer resp.Body.Close() //nolint:errcheck // test cleanup
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read the response body: %v", err)
	}
	var got observed
	if len(raw) > 0 && json.Unmarshal(raw, &got) == nil {
		return &got, resp.StatusCode
	}
	return nil, resp.StatusCode
}

// requireDeliveredObservedAddress checks that the request was served and that
// the upstream saw exactly one client address: the one the proxy observed.
func requireDeliveredObservedAddress(t *testing.T, got *observed, status int, clientSent []string) {
	t.Helper()

	if status != fiber.StatusOK {
		t.Fatalf("the request was not served: status %d (expected 200)", status)
	}
	if got == nil {
		t.Fatalf("the upstream did not report what it received")
	}
	if len(got.RealIP) != 1 || got.RealIP[0] != observedAddress {
		t.Fatalf("the upstream received client addresses %q; want exactly [%q]", got.RealIP, observedAddress)
	}
	for _, sent := range clientSent {
		for _, received := range got.RealIP {
			if received == sent {
				t.Fatalf("the upstream received the caller-supplied address %q", sent)
			}
		}
	}
}

func realIP(got *observed) []string {
	if got == nil {
		return nil
	}
	return got.RealIP
}
