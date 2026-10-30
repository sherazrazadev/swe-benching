package terraform

import (
	"bufio"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
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

	body := "{}"
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

// zzProbeInstallDefaultTransport routes the product's plain http.Client (which
// uses http.DefaultTransport whenever its Transport is nil) through the
// recorder, so a test observes the credential the product actually attaches
// rather than only whether a connection was attempted.
func zzProbeInstallDefaultTransport(t *testing.T) *zzProbeRoundTripper {
	t.Helper()
	rt := &zzProbeRoundTripper{}
	old := http.DefaultTransport
	http.DefaultTransport = rt
	t.Cleanup(func() { http.DefaultTransport = old })
	return rt
}

// zzProbeSeenAuth reports whether any recorded request carried an
// Authorization header, returning the host it was sent to.
func zzProbeSeenAuth(seen []zzProbeRequest) (bool, string) {
	for _, r := range seen {
		if r.auth != "" {
			return true, r.host
		}
	}
	return false, ""
}

// zzProbeCA is a throwaway CA created once per test binary. Its certificate is
// installed as the process trust root (SSL_CERT_FILE) so the product's own HTTP
// clients accept the local registry probe, letting the tests observe the
// Authorization header the product actually sends through whichever getter is
// wired in.
var zzProbeCA *x509.Certificate
var zzProbeCAKey *ecdsa.PrivateKey

func TestMain(m *testing.M) {
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		fmt.Fprintln(os.Stderr, "zz probe: generate CA key:", err)
		os.Exit(1)
	}
	caTmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "zz-probe-ca"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caKey.PublicKey, caKey)
	if err != nil {
		fmt.Fprintln(os.Stderr, "zz probe: create CA:", err)
		os.Exit(1)
	}
	caCert, err := x509.ParseCertificate(caDER)
	if err != nil {
		fmt.Fprintln(os.Stderr, "zz probe: parse CA:", err)
		os.Exit(1)
	}
	zzProbeCA, zzProbeCAKey = caCert, caKey

	dir, err := os.MkdirTemp("", "zz-probe-ca")
	if err != nil {
		fmt.Fprintln(os.Stderr, "zz probe: temp dir:", err)
		os.Exit(1)
	}
	caPath := filepath.Join(dir, "ca.pem")
	if err := os.WriteFile(caPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caDER}), 0o644); err != nil { // nolint:gosec
		fmt.Fprintln(os.Stderr, "zz probe: write CA:", err)
		os.Exit(1)
	}
	// crypto/x509 reads SSL_CERT_FILE when it first builds the system pool. Set
	// it before any test runs so the product's clients trust the probe registry.
	_ = os.Setenv("SSL_CERT_FILE", caPath)
	_ = os.Setenv("SSL_CERT_DIR", dir)

	code := m.Run()
	_ = os.RemoveAll(dir)
	os.Exit(code)
}

// zzProbeRegistryServer is a TLS registry endpoint signed by the probe CA. It
// answers the Terraform registry protocol enough for a module fetch to reach
// the discovery and download steps and records the Authorization header of
// every request it receives, whichever HTTP client the wired getter uses.
type zzProbeRegistryServer struct {
	ln   net.Listener
	mu   sync.Mutex
	seen []zzProbeRequest
}

func zzProbeStartRegistryServer(t *testing.T) *zzProbeRegistryServer {
	t.Helper()
	if zzProbeCA == nil || zzProbeCAKey == nil {
		t.Fatal("probe CA was not initialised")
	}

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(2),
		Subject:               pkix.Name{CommonName: "127.0.0.1"},
		NotBefore:             time.Now().Add(-time.Hour),
		NotAfter:              time.Now().Add(time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, zzProbeCA, &key.PublicKey, zzProbeCAKey)
	if err != nil {
		t.Fatalf("create certificate: %v", err)
	}
	cert := tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}

	ln, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{cert}}) // nolint:gosec
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	s := &zzProbeRegistryServer{ln: ln}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go s.serve(conn)
		}
	}()
	t.Cleanup(func() { _ = ln.Close() })
	return s
}

func (s *zzProbeRegistryServer) serve(conn net.Conn) {
	defer func() { _ = conn.Close() }()
	if tc, ok := conn.(*tls.Conn); ok {
		_ = tc.SetDeadline(time.Now().Add(10 * time.Second))
		if err := tc.Handshake(); err != nil {
			return
		}
	}
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
	req, err := http.ReadRequest(bufio.NewReader(conn))
	if err != nil {
		return
	}

	s.mu.Lock()
	s.seen = append(s.seen, zzProbeRequest{
		host: req.Host,
		path: req.URL.Path,
		auth: req.Header.Get("Authorization"),
	})
	s.mu.Unlock()

	status, body, extra := "200 OK", "{}", ""
	switch {
	case strings.HasSuffix(req.URL.Path, "/.well-known/terraform.json"):
		body = `{"modules.v1":"/v1/modules/"}`
		extra = "Content-Type: application/json\r\n"
	case strings.HasSuffix(req.URL.Path, "/versions"):
		body = `{"modules":[{"versions":[{"version":"1.0.0"}]}]}`
		extra = "Content-Type: application/json\r\n"
	case strings.HasSuffix(req.URL.Path, "/download"):
		// Stop the fetch after the discovery request has been observed.
		status, body = "404 Not Found", "{}"
	}
	_, _ = fmt.Fprintf(conn, "HTTP/1.1 %s\r\n%sContent-Length: %d\r\nConnection: close\r\n\r\n%s", status, extra, len(body), body)
}

func (s *zzProbeRegistryServer) Host() string { return s.ln.Addr().String() }

func (s *zzProbeRegistryServer) Seen() []zzProbeRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]zzProbeRequest, len(s.seen))
	copy(out, s.seen)
	return out
}

// zzProbeStartRegistryFetch drives the real module-fetch entry point with a
// tfr:// source held by this server, which is the path the product uses for
// terragrunt module sources. It returns the provider and any fetch error.
func zzProbeRegistryFetch(t *testing.T, provider *TerragruntHCLProvider, src string) error {
	t.Helper()
	return provider.packageFetcher.Fetch(src, t.TempDir())
}
