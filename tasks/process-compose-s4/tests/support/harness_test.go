package vtesting

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

// binaryUnderTest is the product binary built from the submitted workspace.
func binaryUnderTest() string {
	if p := os.Getenv("PC_BIN"); p != "" {
		return p
	}
	return "/tmp/pc-under-test"
}

const (
	processName = "sleeper"
	// tokenValue satisfies the product's minimum length for a configured token.
	tokenValue = "verifier-token-0123456789abcdef"
)

// freePort asks the OS for an unused TCP port on the loopback interface.
func freePort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("could not reserve a port: %v", err)
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port
}

type serverOpts struct {
	// trustedHosts is written to mcp_server.trusted_hosts when non-nil.
	trustedHosts []string
	// token, when non-empty, is configured as PC_API_TOKEN.
	token string
}

// server is one process-compose instance started for a single test.
type server struct {
	t        *testing.T
	cmd      *exec.Cmd
	restPort int
	mcpPort  int
	dir      string
	token    string
	logFile  *os.File
}

func startServer(t *testing.T, opts serverOpts) *server {
	t.Helper()
	dir := t.TempDir()
	restPort := freePort(t)
	mcpPort := freePort(t)

	var cfg strings.Builder
	cfg.WriteString("mcp_server:\n")
	cfg.WriteString("  host: 127.0.0.1\n")
	fmt.Fprintf(&cfg, "  port: %d\n", mcpPort)
	cfg.WriteString("  expose_control_tools: true\n")
	if opts.trustedHosts != nil {
		cfg.WriteString("  trusted_hosts:\n")
		for _, h := range opts.trustedHosts {
			fmt.Fprintf(&cfg, "    - %q\n", h)
		}
	}
	cfg.WriteString("processes:\n")
	fmt.Fprintf(&cfg, "  %s:\n", processName)
	cfg.WriteString("    command: \"sleep 600\"\n")

	cfgPath := filepath.Join(dir, "process-compose.yaml")
	if err := os.WriteFile(cfgPath, []byte(cfg.String()), 0o644); err != nil {
		t.Fatalf("write config: %v", err)
	}
	logPath := filepath.Join(dir, "process-compose.log")

	cmd := exec.Command(binaryUnderTest(), "-t=false", "-f", cfgPath,
		"--address", "127.0.0.1", "--port", strconv.Itoa(restPort))
	cmd.Env = append(os.Environ(),
		"PC_LOG_FILE="+logPath,
		"PC_LOG_LEVEL=error",
	)
	if opts.token != "" {
		cmd.Env = append(cmd.Env, "PC_API_TOKEN="+opts.token)
	}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	s := &server{t: t, cmd: cmd, restPort: restPort, mcpPort: mcpPort, dir: dir, token: opts.token}
	out, err := os.Create(logPath)
	if err != nil {
		t.Fatalf("create log: %v", err)
	}
	s.logFile = out
	cmd.Stdout = out
	cmd.Stderr = out
	if err := cmd.Start(); err != nil {
		out.Close()
		t.Fatalf("start product: %v", err)
	}
	t.Cleanup(func() {
		s.stop()
		_ = out.Close()
		if b, err := os.ReadFile(logPath); err == nil && t.Failed() && len(b) > 0 {
			t.Logf("product log:\n%s", b)
		}
	})

	// Ready when the REST listener answers its liveness route.
	deadline := time.Now().Add(10 * time.Second)
	for {
		code, _, err := s.restRequest(http.MethodGet, "/live", "", "", nil)
		if err == nil && code == http.StatusOK {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("product did not become ready (last error %v)", err)
		}
		time.Sleep(100 * time.Millisecond)
	}
	// The target process must be running before any operation is attempted.
	for {
		running, err := s.processRunning(processName)
		if err == nil && running {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("target process did not start (last error %v)", err)
		}
		time.Sleep(100 * time.Millisecond)
	}
	return s
}

func (s *server) stop() {
	if s.cmd == nil || s.cmd.Process == nil {
		return
	}
	_ = syscall.Kill(-s.cmd.Process.Pid, syscall.SIGTERM)
	done := make(chan struct{})
	go func() { _ = s.cmd.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		_ = syscall.Kill(-s.cmd.Process.Pid, syscall.SIGKILL)
		<-done
	}
	_ = syscall.Kill(-s.cmd.Process.Pid, syscall.SIGKILL)
}

func (s *server) restURL(path string) string {
	return fmt.Sprintf("http://127.0.0.1:%d%s", s.restPort, path)
}

func (s *server) mcpURL(path string) string {
	return fmt.Sprintf("http://127.0.0.1:%d%s", s.mcpPort, path)
}

// restRequest drives the REST listener. host overrides the Host header while
// the connection still goes to the real listener; origin, when non-empty, is
// sent as the Origin header. The configured token is attached automatically so
// administrative checks keep working when a token is configured.
func (s *server) restRequest(method, path, host, origin string, body []byte) (int, []byte, error) {
	req, err := http.NewRequest(method, s.restURL(path), bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	if host != "" {
		req.Host = host
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if s.token != "" {
		req.Header.Set("X-PC-Token-Key", s.token)
	}
	return doRequest(req, 8*time.Second)
}

// mcpRequest drives the MCP listener with an explicit header set.
func (s *server) mcpRequest(method, path, host, origin string, headers map[string]string, body []byte) (int, []byte, error) {
	req, err := http.NewRequest(method, s.mcpURL(path), bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	if host != "" {
		req.Host = host
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return doRequest(req, 8*time.Second)
}

func doRequest(req *http.Request, timeout time.Duration) (int, []byte, error) {
	client := &http.Client{
		Timeout:   timeout,
		Transport: &http.Transport{DisableKeepAlives: true},
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return resp.StatusCode, data, nil
}

// processRunning reads the target process state through the REST listener with
// an ordinary (trusted) request.
func (s *server) processRunning(name string) (bool, error) {
	code, data, err := s.restRequest(http.MethodGet, "/process/"+url.PathEscape(name), "", "", nil)
	if err != nil {
		return false, err
	}
	if code != http.StatusOK {
		return false, fmt.Errorf("process state: status %d", code)
	}
	var st struct {
		IsRunning bool `json:"is_running"`
	}
	if err := json.Unmarshal(data, &st); err != nil {
		return false, err
	}
	return st.IsRunning, nil
}

// serverAlive reports whether the REST listener still answers.
func (s *server) serverAlive() bool {
	code, _, err := s.restRequest(http.MethodGet, "/live", "", "", nil)
	return err == nil && code == http.StatusOK
}

// isClientError reports a clean refusal: a 4xx response.
func isClientError(code int) bool { return code >= 400 && code < 500 }

// --- MCP SSE session -------------------------------------------------------

type sseStream struct {
	resp     *http.Response
	cancel   context.CancelFunc
	endpoint string
	scanner  *bufio.Scanner
}

// openSSE opens the MCP SSE stream and returns it once the transport has
// advertised its message endpoint. A non-200 response is returned as an error
// carrying the status, so callers can assert a refusal.
func (s *server) openSSE(host, origin string, headers map[string]string) (*sseStream, int, error) {
	ctx, cancel := context.WithCancel(context.Background())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.mcpURL("/sse"), nil)
	if err != nil {
		cancel()
		return nil, 0, err
	}
	if host != "" {
		req.Host = host
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	client := &http.Client{Transport: &http.Transport{DisableKeepAlives: true}}
	resp, err := client.Do(req)
	if err != nil {
		cancel()
		return nil, 0, err
	}
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		cancel()
		return nil, resp.StatusCode, nil
	}
	st := &sseStream{resp: resp, cancel: cancel, scanner: bufio.NewScanner(resp.Body)}
	st.scanner.Buffer(make([]byte, 64*1024), 1<<20)
	ep, err := st.waitEndpoint(10 * time.Second)
	if err != nil {
		st.Close()
		return nil, resp.StatusCode, err
	}
	st.endpoint = ep
	return st, resp.StatusCode, nil
}

func (st *sseStream) waitEndpoint(timeout time.Duration) (string, error) {
	type result struct {
		ep  string
		err error
	}
	ch := make(chan result, 1)
	go func() {
		for st.scanner.Scan() {
			line := st.scanner.Text()
			if !strings.HasPrefix(line, "data:") || !strings.Contains(line, "sessionId=") {
				continue
			}
			data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if _, err := url.Parse(data); err != nil {
				ch <- result{err: fmt.Errorf("malformed endpoint %q", data)}
				return
			}
			ch <- result{ep: data}
			return
		}
		if err := st.scanner.Err(); err != nil {
			ch <- result{err: err}
			return
		}
		ch <- result{err: fmt.Errorf("stream ended before the endpoint event")}
	}()
	select {
	case r := <-ch:
		return r.ep, r.err
	case <-time.After(timeout):
		return "", fmt.Errorf("timed out waiting for the endpoint event")
	}
}

func (st *sseStream) Close() {
	if st == nil {
		return
	}
	st.cancel()
	_ = st.resp.Body.Close()
}

// call posts a JSON-RPC message to the session's message endpoint. host and
// origin control the headers seen by the listener.
func (s *server) call(st *sseStream, host, origin, token string, msg map[string]any) (int, []byte, error) {
	body, err := json.Marshal(msg)
	if err != nil {
		return 0, nil, err
	}
	headers := map[string]string{}
	if token != "" {
		headers["X-PC-Token-Key"] = token
	}
	return s.mcpRequest(http.MethodPost, st.endpoint, host, origin, headers, body)
}

func initializeMessage() map[string]any {
	return map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]any{},
			"clientInfo":      map[string]any{"name": "verifier", "version": "1"},
		},
	}
}

func initializedNotification() map[string]any {
	return map[string]any{"jsonrpc": "2.0", "method": "notifications/initialized"}
}

func stopToolCall(names ...string) map[string]any {
	return map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/call",
		"params": map[string]any{
			"name":      "pc_process_stop",
			"arguments": map[string]any{"names": names},
		},
	}
}

// startSession opens a trustworthy session and completes the MCP handshake.
func (s *server) startSession(host, origin string) (*sseStream, error) {
	headers := map[string]string{}
	if s.token != "" {
		headers["X-PC-Token-Key"] = s.token
	}
	st, status, err := s.openSSE(host, origin, headers)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, fmt.Errorf("trusted session refused (status %d)", status)
	}
	code, _, err := s.call(st, host, origin, s.token, initializeMessage())
	if err != nil || code >= 300 {
		st.Close()
		return nil, fmt.Errorf("initialize failed: status %d err %v", code, err)
	}
	if _, _, err := s.call(st, host, origin, s.token, initializedNotification()); err != nil {
		st.Close()
		return nil, err
	}
	return st, nil
}

func isClientErrorOrOK(code int) bool { return code == http.StatusOK || code == http.StatusAccepted || isClientError(code) }

// --- WebSocket handshake ---------------------------------------------------

type wsResult struct {
	status  string // first response line, e.g. "HTTP/1.1 101 Switching Protocols"
	payload []byte // bytes received after the response headers, if any
}

// wsHandshake sends a real WebSocket upgrade request and reports the response
// line. Reading stops after the header block (plus any immediately available
// frame bytes).
func (s *server) wsHandshake(path, host, origin string) (*wsResult, error) {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", s.restPort), 5*time.Second)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))

	var req strings.Builder
	fmt.Fprintf(&req, "GET %s HTTP/1.1\r\n", path)
	fmt.Fprintf(&req, "Host: %s\r\n", host)
	req.WriteString("Upgrade: websocket\r\n")
	req.WriteString("Connection: Upgrade\r\n")
	req.WriteString("Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n")
	req.WriteString("Sec-WebSocket-Version: 13\r\n")
	if origin != "" {
		fmt.Fprintf(&req, "Origin: %s\r\n", origin)
	}
	req.WriteString("\r\n")
	if _, err := io.WriteString(conn, req.String()); err != nil {
		return nil, err
	}

	br := bufio.NewReader(conn)
	line, err := br.ReadString('\n')
	if err != nil {
		return nil, err
	}
	res := &wsResult{status: strings.TrimSpace(line)}
	// Consume the rest of the response headers.
	for {
		h, err := br.ReadString('\n')
		if err != nil {
			break
		}
		if strings.TrimSpace(h) == "" {
			break
		}
	}
	if strings.Contains(res.status, "101") {
		buf := make([]byte, 4096)
		_ = conn.SetReadDeadline(time.Now().Add(10 * time.Second))
		n, _ := br.Read(buf)
		res.payload = append(res.payload, buf[:n]...)
	}
	return res, nil
}
