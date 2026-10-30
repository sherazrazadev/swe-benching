package hcl

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
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/extclient"
	"github.com/infracost/infracost/internal/hcl/modules"
	intsync "github.com/infracost/infracost/internal/sync"
)

// zzProbeCA is a throwaway CA created once per test binary. Its certificate is
// installed as the process trust root (SSL_CERT_FILE) so the product's own HTTP
// client accepts the local probe servers, letting the tests observe the
// Authorization header the product actually sends.
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
	// it before any test runs so the product's client trusts the probe server.
	_ = os.Setenv("SSL_CERT_FILE", caPath)
	_ = os.Setenv("SSL_CERT_DIR", dir)

	code := m.Run()
	_ = os.RemoveAll(dir)
	os.Exit(code)
}

// zzProbeBlocks parses the given Terraform source into Blocks so the remote
// variables loader can be exercised without touching the network.
func zzProbeBlocks(t *testing.T, contents string) Blocks {
	t.Helper()

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "main.tf"), []byte(contents), 0o644); err != nil { // nolint:gosec
		t.Fatalf("write main.tf: %v", err)
	}

	logger := zerolog.Nop()
	loader := modules.NewModuleLoader(modules.ModuleLoaderOptions{
		CachePath:         dir,
		HCLParser:         modules.NewSharedHCLParser(),
		CredentialsSource: nil,
		SourceMap:         config.TerraformSourceMap{},
		SourceMapRegex:    nil,
		Logger:            logger,
		ModuleSync:        &intsync.KeyMutex{},
	})
	parser := NewParser(
		RootPath{DetectedPath: dir},
		CreateEnvFileMatcher([]string{}, nil),
		loader,
		logger,
	)

	module, err := parser.ParseDirectory()
	if err != nil {
		t.Fatalf("parse terraform: %v", err)
	}

	return module.Blocks
}

// zzProbeNewTFCLoader constructs the loader through its real constructor. The
// constructor is called reflectively so the test keeps compiling when a fix
// adds a parameter (for example a trusted-host flag) to it: the helper fills
// each parameter by type. That way a fix which records trusted state in the
// constructor is exercised, not bypassed by a struct literal.
func zzProbeNewTFCLoader(t *testing.T, client *extclient.AuthedAPIClient, hostConfigured bool, logger zerolog.Logger, opts ...TFCRemoteVariablesLoaderOption) *TFCRemoteVariablesLoader {
	t.Helper()

	fn := reflect.ValueOf(NewTFCRemoteVariablesLoader)
	ft := fn.Type()
	n := ft.NumIn()
	fixed := n
	if ft.IsVariadic() {
		fixed = n - 1
	}

	args := make([]reflect.Value, 0, n+len(opts))
	for i := 0; i < fixed; i++ {
		pt := ft.In(i)
		switch {
		case pt == reflect.TypeOf(client):
			args = append(args, reflect.ValueOf(client))
		case pt.Kind() == reflect.String:
			// local workspace / an optional trusted host: the empty workspace is
			// correct for these tests, which use named workspaces.
			args = append(args, reflect.ValueOf(""))
		case pt.Kind() == reflect.Bool:
			args = append(args, reflect.ValueOf(hostConfigured))
		case pt == reflect.TypeOf(logger):
			args = append(args, reflect.ValueOf(logger))
		default:
			t.Fatalf("NewTFCRemoteVariablesLoader has an unsupported parameter at %d (%s)", i, pt)
		}
	}
	if ft.IsVariadic() {
		elem := ft.In(n - 1).Elem()
		for _, o := range opts {
			ov := reflect.ValueOf(o)
			if !ov.Type().AssignableTo(elem) {
				t.Fatalf("loader option %s is not assignable to %s", ov.Type(), elem)
			}
			args = append(args, ov)
		}
	} else if len(opts) > 0 {
		t.Fatalf("NewTFCRemoteVariablesLoader takes no options")
	}

	out := fn.Call(args)
	loader, ok := out[0].Interface().(*TFCRemoteVariablesLoader)
	if !ok {
		t.Fatalf("NewTFCRemoteVariablesLoader returned %s", out[0].Type())
	}
	return loader
}

type zzProbeRequest struct {
	host string
	path string
	auth string
}

// zzProbeRecorder is a TLS listener signed by the probe CA. It records the
// Authorization header of every HTTP request it receives and answers 200 with
// an empty JSON object. Because the product's client trusts the CA, a request
// that is made is observed even when the fix continues without the credential.
type zzProbeRecorder struct {
	ln net.Listener
	mu sync.Mutex
	n  int
	seen []zzProbeRequest
}

func zzProbeStartRecorder(t *testing.T) *zzProbeRecorder {
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

	r := &zzProbeRecorder{ln: ln}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go r.serve(conn)
		}
	}()
	t.Cleanup(func() { _ = ln.Close() })

	return r
}

func (r *zzProbeRecorder) serve(conn net.Conn) {
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
	r.mu.Lock()
	r.n++
	r.seen = append(r.seen, zzProbeRequest{
		host: req.Host,
		path: req.URL.Path,
		auth: req.Header.Get("Authorization"),
	})
	r.mu.Unlock()

	body := "{}"
	_, _ = fmt.Fprintf(conn, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\nConnection: close\r\n\r\n%s", len(body), body)
}

func (r *zzProbeRecorder) Host() string { return r.ln.Addr().String() }

func (r *zzProbeRecorder) Requests() []zzProbeRequest {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]zzProbeRequest, len(r.seen))
	copy(out, r.seen)
	return out
}

func (r *zzProbeRecorder) Count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.n
}

// zzProbeHasAuth reports whether any request carried an Authorization header,
// and returns it for a useful failure message.
func zzProbeHasAuth(seen []zzProbeRequest) (bool, string) {
	for _, req := range seen {
		if req.auth != "" {
			return true, req.host
		}
	}
	return false, ""
}
