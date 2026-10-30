package hcl

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"

	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/hcl/modules"
	intsync "github.com/infracost/infracost/internal/sync"
)

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

// zzProbeConnCounter is a TLS listener that counts every inbound connection.
// The certificate is self-signed, so a client that connects fails certificate
// verification after the handshake and does not retry.
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
