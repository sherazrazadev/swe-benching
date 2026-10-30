// Package functional drives the built tinyauth server over its real HTTP entry point.
//
// Every test starts the product binary with a generated configuration, talks to
// /api/auth/:proxy over a unix socket exactly as a reverse proxy would, and
// authenticates with the product's own HTTP Basic support. The only external
// authority that is stubbed is the Docker Engine API, served over a unix socket.
package functional

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

const (
	binaryPath   = "/workspace/tinyauth"
	testPassword = "password"
	// bcrypt hash of testPassword.
	passwordHash = "$2a$10$XUwWrKEHrL59JLxUa6SJJeBcUsUMcfIEY.SEkreLRzVYW7EykNbPC"
)

type appSpec struct {
	Name      string
	Domain    string
	Allow     string
	Block     string
	Headers   []string
	BasicUser string
	BasicPass string
}

type serverOptions struct {
	Apps              []appSpec
	LabelProvider     string
	LabelProviderPath string
	DockerHost        string
	Policy            string
}

type testServer struct {
	client  *http.Client
	cmd     *exec.Cmd
	dir     string
	logPath string
	once    sync.Once
}

func binary(t *testing.T) string {
	t.Helper()

	bin := os.Getenv("TINYAUTH_BIN")

	if bin == "" {
		bin = binaryPath
	}

	if _, err := os.Stat(bin); err != nil {
		t.Fatalf("tinyauth binary %q is not available: %v", bin, err)
	}

	return bin
}

func startServer(t *testing.T, opt serverOptions) *testServer {
	t.Helper()

	dir, err := os.MkdirTemp("", "tinyauth-http-")

	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}

	t.Cleanup(func() { os.RemoveAll(dir) })

	socket := filepath.Join(dir, "tinyauth.sock")

	if opt.Policy == "" {
		opt.Policy = "allow"
	}

	configPath := filepath.Join(dir, "config.yaml")

	if err := os.WriteFile(configPath, []byte(renderConfig(opt, socket)), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	logPath := filepath.Join(dir, "server.log")
	logFile, err := os.Create(logPath)

	if err != nil {
		t.Fatalf("create log: %v", err)
	}

	cmd := exec.Command(binary(t))
	cmd.Env = []string{
		"PATH=/usr/local/bin:/usr/bin:/bin",
		"HOME=" + dir,
		"TMPDIR=" + dir,
		"LANG=C.UTF-8",
		"TINYAUTH_CONFIGFILE=" + configPath,
	}

	if opt.LabelProvider == "docker" && opt.DockerHost != "" {
		cmd.Env = append(cmd.Env, "DOCKER_HOST=unix://"+opt.DockerHost, "DOCKER_API_VERSION=1.45")
	}

	cmd.Stdout = logFile
	cmd.Stderr = logFile

	if err := cmd.Start(); err != nil {
		logFile.Close()
		t.Fatalf("start tinyauth: %v", err)
	}

	logFile.Close()

	s := &testServer{cmd: cmd, dir: dir, logPath: logPath}
	s.client = unixClient(socket)
	t.Cleanup(s.stop)

	deadline := time.Now().Add(25 * time.Second)

	for {
		resp, err := s.client.Get("http://unix/api/healthz")

		if err == nil {
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			break
		}

		if time.Now().After(deadline) {
			s.stop()
			t.Fatalf("server did not become ready; log:\n%s", readFile(logPath))
		}

		time.Sleep(50 * time.Millisecond)
	}

	return s
}

func (s *testServer) stop() {
	s.once.Do(func() {
		if s.cmd != nil && s.cmd.Process != nil {
			s.cmd.Process.Signal(os.Interrupt)
			done := make(chan struct{})

			go func() {
				s.cmd.Wait()
				close(done)
			}()

			select {
			case <-done:
			case <-time.After(5 * time.Second):
				s.cmd.Process.Kill()
			}
		}
	})
}

func (s *testServer) log() string {
	return readFile(s.logPath)
}

func readFile(path string) string {
	data, err := os.ReadFile(path)

	if err != nil {
		return ""
	}

	return string(data)
}

func unixClient(socket string) *http.Client {
	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			dialer := &net.Dialer{}
			return dialer.DialContext(ctx, "unix", socket)
		},
	}

	return &http.Client{Transport: transport, Timeout: 15 * time.Second}
}

// auth issues one proxy authentication request. proxy selects the host source:
// traefik/caddy read x-forwarded-host, nginx reads x-original-url, envoy reads
// the request host and the path query.
func (s *testServer) auth(t *testing.T, proxy, user, host, uri string) (int, http.Header, string) {
	t.Helper()

	req, err := http.NewRequest("GET", "http://unix/api/auth/"+proxy, nil)

	if err != nil {
		t.Fatalf("build request: %v", err)
	}

	req.SetBasicAuth(user, testPassword)

	switch proxy {
	case "traefik", "caddy":
		req.Header.Set("x-forwarded-host", host)
		req.Header.Set("x-forwarded-proto", "https")
		req.Header.Set("x-forwarded-uri", uri)
	case "nginx":
		req.Header.Set("x-original-url", "https://"+host+uri)
	case "envoy":
		req.Host = host
		req.Header.Set("x-forwarded-proto", "https")
		query := req.URL.Query()
		query.Set("path", uri)
		req.URL.RawQuery = query.Encode()
	default:
		t.Fatalf("unsupported proxy %q", proxy)
	}

	resp, err := s.client.Do(req)

	if err != nil {
		t.Fatalf("request failed: %v\nserver log:\n%s", err, s.log())
	}

	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	return resp.StatusCode, resp.Header, string(body)
}

func assertBlocked(t *testing.T, status int, header http.Header, body string) {
	t.Helper()

	if status >= 200 && status < 300 {
		t.Fatalf("the request was admitted (status %d): %s", status, body)
	}

	if status < 400 || status >= 500 {
		t.Fatalf("the request was not refused with a client error (status %d): %s", status, body)
	}

	for _, name := range []string{"Remote-User", "Remote-Name", "Remote-Email"} {
		if header.Get(name) != "" {
			t.Fatalf("refusal carried identity header %s=%q", name, header.Get(name))
		}
	}
}

func assertAdmitted(t *testing.T, status int, header http.Header, body, user string) {
	t.Helper()

	if status != 200 {
		t.Fatalf("legitimate request was refused (status %d): %s\nserver log:\n%s", status, body, "")
	}

	if got := header.Get("Remote-User"); got != user {
		t.Fatalf("legitimate request carried Remote-User=%q, want %q", got, user)
	}
}

func renderConfig(opt serverOptions, socket string) string {
	var b strings.Builder

	b.WriteString("appUrl: \"https://auth.example.com\"\n")

	provider := opt.LabelProvider

	if provider == "" {
		provider = "none"
	}

	fmt.Fprintf(&b, "labelProvider: %q\n", provider)

	if opt.LabelProviderPath != "" {
		fmt.Fprintf(&b, "labelProviderPath: %q\n", opt.LabelProviderPath)
	}

	b.WriteString("database:\n  driver: memory\n")
	b.WriteString("analytics:\n  enabled: false\n")
	fmt.Fprintf(&b, "server:\n  socketPath: %q\n", socket)
	b.WriteString("auth:\n  users:\n")

	for _, user := range []string{"alice", "mallory", "bob"} {
		fmt.Fprintf(&b, "    - %q\n", user+":"+passwordHash)
	}

	b.WriteString("  subdomainsEnabled: true\n  lockdownEnabled: false\n  acls:\n")
	fmt.Fprintf(&b, "    policy: %q\n", opt.Policy)

	if len(opt.Apps) > 0 {
		b.WriteString("apps:\n")

		for _, app := range opt.Apps {
			fmt.Fprintf(&b, "  %q:\n", app.Name)
			b.WriteString("    config:\n")
			fmt.Fprintf(&b, "      domain: %q\n", app.Domain)

			if app.Allow != "" || app.Block != "" {
				b.WriteString("    users:\n")

				if app.Allow != "" {
					fmt.Fprintf(&b, "      allow: %q\n", app.Allow)
				}

				if app.Block != "" {
					fmt.Fprintf(&b, "      block: %q\n", app.Block)
				}
			}

			if len(app.Headers) > 0 || app.BasicUser != "" {
				b.WriteString("    response:\n")

				if len(app.Headers) > 0 {
					b.WriteString("      headers:\n")

					for _, header := range app.Headers {
						fmt.Fprintf(&b, "        - %q\n", header)
					}
				}

				if app.BasicUser != "" {
					b.WriteString("      basicAuth:\n")
					fmt.Fprintf(&b, "        username: %q\n", app.BasicUser)
					fmt.Fprintf(&b, "        password: %q\n", app.BasicPass)
				}
			}
		}
	}

	return b.String()
}

// writeConfigMap builds a directory shaped like a mounted ConfigMap. Each app
// becomes the same "tinyauth.apps.*" keys the other label sources use, and an
// optional hosts file lists the hostnames the deployment serves.
func writeConfigMap(t *testing.T, hosts []string, apps ...appSpec) string {
	t.Helper()

	dir := t.TempDir()

	if hosts != nil {
		writeEntry(t, dir, "hosts", strings.Join(hosts, "\n")+"\n")
	}

	for _, app := range apps {
		writeEntry(t, dir, "tinyauth.apps."+app.Name+".config.domain", app.Domain)

		if app.Allow != "" {
			writeEntry(t, dir, "tinyauth.apps."+app.Name+".users.allow", app.Allow)
		}

		if app.Block != "" {
			writeEntry(t, dir, "tinyauth.apps."+app.Name+".users.block", app.Block)
		}
	}

	return dir
}

func writeEntry(t *testing.T, dir, name, value string) {
	t.Helper()

	if err := os.WriteFile(filepath.Join(dir, name), []byte(value), 0o600); err != nil {
		t.Fatalf("write configmap entry %s: %v", name, err)
	}
}

// startFakeDocker serves the two Docker Engine API calls the container label
// provider makes, returning one container with the supplied labels.
func startFakeDocker(t *testing.T, labels map[string]string) string {
	t.Helper()

	socket := filepath.Join(t.TempDir(), "docker.sock")
	listener, err := net.Listen("unix", socket)

	if err != nil {
		t.Fatalf("fake docker listen: %v", err)
	}

	list := []map[string]any{{"Id": "cid1", "Names": []string{"/app"}, "Image": "app:latest"}}
	inspect := map[string]any{
		"Id":   "cid1",
		"Name": "/app",
		"Config": map[string]any{
			"Labels": labels,
		},
	}

	listBody, _ := json.Marshal(list)
	inspectBody, _ := json.Marshal(inspect)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/_ping"):
			w.Header().Set("API-Version", "1.45")
			w.Header().Set("Ostype", "linux")
			w.WriteHeader(200)
			w.Write([]byte("OK"))
		case strings.Contains(r.URL.Path, "/containers/json"):
			w.Header().Set("Content-Type", "application/json")
			w.Write(listBody)
		case strings.Contains(r.URL.Path, "/containers/cid1/json"):
			w.Header().Set("Content-Type", "application/json")
			w.Write(inspectBody)
		default:
			http.NotFound(w, r)
		}
	})

	server := &http.Server{Handler: handler}

	go server.Serve(listener)

	t.Cleanup(func() {
		server.Close()
		os.Remove(socket)
	})

	return socket
}
