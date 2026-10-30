package terraform

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"io"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/hashicorp/go-retryablehttp"
)

// zzProbeConnCounter is a TLS listener that counts every inbound connection.
// Its certificate is self-signed, so a client that reaches it fails
// certificate verification rather than retrying.
type zzProbeConnCounter struct {
	ln net.Listener
	mu sync.Mutex
	n  int
}

func zzProbeStartConnCounter(t *testing.T) *zzProbeConnCounter {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "127.0.0.1"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IsCA:                  true,
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}
	cert := tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}

	ln, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{cert}}) // nolint:gosec
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	c := &zzProbeConnCounter{ln: ln}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			c.mu.Lock()
			c.n++
			c.mu.Unlock()
			go func(conn net.Conn) {
				if tc, ok := conn.(*tls.Conn); ok {
					_ = tc.SetDeadline(time.Now().Add(5 * time.Second))
					_ = tc.Handshake()
				}
				_ = conn.Close()
			}(conn)
		}
	}()
	t.Cleanup(func() { _ = ln.Close() })

	return c
}

func (c *zzProbeConnCounter) Host() string { return c.ln.Addr().String() }

func (c *zzProbeConnCounter) Count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.n
}

// zzProbeStubTerraform writes a terraform stand-in that prints the remote-run
// line terraform prints after a remote plan.
func zzProbeStubTerraform(t *testing.T, visitURL string) *CmdOptions {
	t.Helper()

	dir := t.TempDir()
	script := filepath.Join(dir, "terraform")
	body := "#!/bin/sh\n" +
		"echo \"To view this run in a browser, visit:\"\n" +
		"echo \"" + visitURL + "\"\n"
	if err := os.WriteFile(script, []byte(body), 0o755); err != nil { // nolint:gosec
		t.Fatalf("write terraform stub: %v", err)
	}

	return &CmdOptions{TerraformBinary: script, Dir: dir}
}

type zzProbeRequest struct {
	host string
	path string
	auth string
}

// zzProbeRoundTripper records every request and answers registry protocol
// requests with harmless canned responses.
type zzProbeRoundTripper struct {
	mu       sync.Mutex
	seen     []zzProbeRequest
	versions string
}

func (rt *zzProbeRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.mu.Lock()
	rt.seen = append(rt.seen, zzProbeRequest{
		host: req.URL.Host,
		path: req.URL.Path,
		auth: req.Header.Get("Authorization"),
	})
	rt.mu.Unlock()

	body := ""
	header := http.Header{}
	if strings.HasSuffix(req.URL.Path, "/.well-known/terraform.json") {
		body = `{"modules.v1":"/v1/modules/"}`
		header.Set("Content-Type", "application/json")
	} else if strings.HasSuffix(req.URL.Path, "/versions") {
		body = rt.versions
		if body == "" {
			body = `{"modules":[{"versions":[{"version":"1.0.0"}]}]}`
		}
		header.Set("Content-Type", "application/json")
	}

	return &http.Response{
		StatusCode: 200,
		Status:     "200 OK",
		Header:     header,
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    req,
	}, nil
}

func (rt *zzProbeRoundTripper) Seen() []zzProbeRequest {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	out := make([]zzProbeRequest, len(rt.seen))
	copy(out, rt.seen)
	return out
}

func zzProbeRetryableClient(rt http.RoundTripper) *retryablehttp.Client {
	c := retryablehttp.NewClient()
	c.HTTPClient = &http.Client{Transport: rt}
	c.RetryMax = 0
	return c
}
