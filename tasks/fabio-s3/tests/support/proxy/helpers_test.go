package proxy_test

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/fabiolb/fabio/config"
	"github.com/fabiolb/fabio/proxy"
	"github.com/fabiolb/fabio/route"
)

// Fixed request id so assertions never depend on the generator.
const hUUID = "01234567-89ab-cdef-0123-456789abcdef"

// hSink records the headers of the last request a backend received.
type hSink struct {
	mu  sync.Mutex
	hdr http.Header
}

func (s *hSink) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	s.hdr = r.Header.Clone()
	s.mu.Unlock()
	w.WriteHeader(http.StatusOK)
}

func (s *hSink) header() http.Header {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.hdr == nil {
		return http.Header{}
	}
	return s.hdr.Clone()
}

func (s *hSink) server(t *testing.T) *httptest.Server {
	srv := httptest.NewServer(s)
	t.Cleanup(srv.Close)
	return srv
}

// hLookup returns every request to the given backend.
func hLookup(raw string) func(*http.Request) *route.Target {
	u, err := url.Parse(raw)
	if err != nil {
		panic(err)
	}
	tgt := &route.Target{URL: u}
	return func(*http.Request) *route.Target { return tgt }
}

// hProxy builds the exported proxy the way an embedding program does: configuration
// and routing only, no extra header bookkeeping.
func hProxy(t *testing.T, cfg config.Proxy, lookup func(*http.Request) *route.Target, withTLS bool) *httptest.Server {
	p := &proxy.HTTPProxy{Config: cfg, Transport: http.DefaultTransport, Lookup: lookup}
	if cfg.RequestID != "" {
		p.UUID = func() string { return hUUID }
	}
	var srv *httptest.Server
	if withTLS {
		srv = httptest.NewTLSServer(p)
	} else {
		srv = httptest.NewServer(p)
	}
	t.Cleanup(srv.Close)
	return srv
}

// hGet forwards one request through the proxy with the supplied Connection lines.
func hGet(t *testing.T, client *http.Client, rawurl string, connection []string, headers map[string]string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, rawurl, nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "svc.example"
	for _, c := range connection {
		req.Header.Add("Connection", c)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("request through the proxy failed: %v", err)
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	return resp
}

// hRawSink is a backend that records a websocket handshake and completes it.
type hRawSink struct {
	ln net.Listener
	ch chan http.Header
}

func hNewRawSink(t *testing.T) (*hRawSink, string) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	s := &hRawSink{ln: ln, ch: make(chan http.Header, 8)}
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				c.SetReadDeadline(time.Now().Add(10 * time.Second))
				req, err := http.ReadRequest(bufio.NewReader(c))
				if err != nil {
					return
				}
				s.ch <- req.Header.Clone()
				fmt.Fprint(c, "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n")
				io.Copy(io.Discard, c)
			}(c)
		}
	}()
	t.Cleanup(func() { ln.Close() })
	return s, ln.Addr().String()
}

func (s *hRawSink) next(t *testing.T) http.Header {
	t.Helper()
	select {
	case h := <-s.ch:
		return h
	case <-time.After(10 * time.Second):
		t.Fatal("the backend never received a websocket handshake")
		return nil
	}
}

// hRawHandshake sends a websocket handshake through the proxy and requires the
// backend handshake to complete.
func hRawHandshake(t *testing.T, proxyAddr string, connection []string, headers map[string]string) {
	t.Helper()
	conn, err := net.DialTimeout("tcp", proxyAddr, 5*time.Second)
	if err != nil {
		t.Fatalf("dial proxy: %v", err)
	}
	defer conn.Close()
	req, err := http.NewRequest(http.MethodGet, "http://svc.example/", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "svc.example"
	req.Header.Set("Upgrade", "websocket")
	for _, c := range connection {
		req.Header.Add("Connection", c)
	}
	req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
	req.Header.Set("Sec-WebSocket-Version", "13")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if err := req.Write(conn); err != nil {
		t.Fatalf("write handshake: %v", err)
	}
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	line, err := bufio.NewReader(conn).ReadString('\n')
	if err != nil {
		t.Fatalf("read handshake response: %v", err)
	}
	if !strings.Contains(line, "101") {
		t.Fatalf("websocket handshake did not upgrade: %q", line)
	}
}

func hFreePort(t *testing.T) int {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := ln.Addr().(*net.TCPAddr).Port
	ln.Close()
	return port
}

// hStartFabio runs the built service with a static route to backendURL. It returns
// the listening address once the proxy forwards requests.
func hStartFabio(t *testing.T, backendURL string, extraArgs ...string) string {
	t.Helper()
	bin := os.Getenv("FABIO_BIN")
	if bin == "" {
		t.Fatal("FABIO_BIN is not set")
	}
	port := hFreePort(t)
	args := []string{
		"-proxy.addr", fmt.Sprintf("addr=127.0.0.1:%d;proto=http", port),
		"-registry.backend", "static",
		"-registry.static.routes", "route add svc / " + backendURL,
		"-ui.addr", "",
		"-log.level", "ERROR",
	}
	args = append(args, extraArgs...)
	cmd := exec.Command(bin, args...)
	var out strings.Builder
	cmd.Stdout = &out
	cmd.Stderr = &out
	if err := cmd.Start(); err != nil {
		t.Fatalf("start service: %v", err)
	}
	t.Cleanup(func() {
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		cmd.Wait()
	})
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	client := &http.Client{Timeout: 2 * time.Second}
	deadline := time.Now().Add(30 * time.Second)
	for time.Now().Before(deadline) {
		req, err := http.NewRequest(http.MethodGet, "http://"+addr+"/__ready", nil)
		if err == nil {
			req.Host = "svc.example"
			resp, err := client.Do(req)
			if err == nil {
				io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					return addr
				}
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Fatalf("service did not start forwarding requests; output:\n%s", out.String())
	return addr
}

// hGetAddr sends a request to a host:port address (used for the running service).
func hGetAddr(t *testing.T, addr string, connection []string, headers map[string]string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, "http://"+addr+"/resource", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Host = "svc.example"
	for _, c := range connection {
		req.Header.Add("Connection", c)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		t.Fatalf("request to the service failed: %v", err)
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	return resp
}
