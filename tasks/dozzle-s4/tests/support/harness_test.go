// Package vtesting holds the hidden behavioural tests for the dozzle-s4 task.
//
// Every test drives the product's real HTTP router (web.CreateServer) with the real
// forward-proxy authentication middleware. The host service is a stub that answers
// per container and per label, the way a real Docker host answers the label filter,
// so tests never depend on a Docker daemon. Expected values are computed here; the
// tests do not call product helpers to decide what is permitted.
package vtesting

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/amir20/dozzle/internal/auth"
	"github.com/amir20/dozzle/internal/container"
	container_support "github.com/amir20/dozzle/internal/support/container"
	"github.com/amir20/dozzle/internal/utils"
	"github.com/amir20/dozzle/internal/web"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/rs/zerolog"
)

// The caller permitted set: containers carrying team=red.
const permittedFilter = "team=red"

const (
	visibleID   = "a1b2c3d4e5f6"
	visibleName = "visible-app"
	hiddenID    = "0f0e0d0c0b0a"
	hiddenName  = "hidden-db"
	remoteID    = "998877665544"
	remoteName  = "remote-app"
	laterID     = "cafebabef00d"
	laterName   = "later-app"
)

// fixture is the fixed set of containers every test starts from. hostA is the
// local host, hostB is a second joined host. Only the team=red containers are in
// the caller's permitted set; hidden-db is not.
func fixture() []container.Container {
	return []container.Container{
		newContainer(visibleID, visibleName, "hostA", "red", "running"),
		newContainer(hiddenID, hiddenName, "hostA", "blue", "running"),
		newContainer(remoteID, remoteName, "hostB", "red", "running"),
	}
}

func newContainer(id, name, host, team, state string) container.Container {
	stats := utils.NewRingBuffer[container.ContainerStat](300)
	stats.Push(container.ContainerStat{ID: id, CPUPercent: 1.5, MemoryPercent: 2.5, MemoryUsage: 1024})
	return container.Container{
		ID:       id,
		Name:     name,
		Image:    "example/" + name + ":1",
		State:    state,
		Host:     host,
		Labels:   map[string]string{"team": team},
		Stats:    stats,
		CPULimit: 1,
	}
}

// matchesLabels mirrors what a Docker host does with a label filter: a container
// is returned only when every requested key carries one of the requested values.
func matchesLabels(c container.Container, labels container.ContainerLabels) bool {
	if len(labels) == 0 {
		return true
	}
	for key, wanted := range labels {
		value, ok := c.Labels[key]
		if !ok {
			return false
		}
		found := false
		for _, w := range wanted {
			if value == w {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// fakeHost is a per-resource permission stub for web.HostService. Unused
// notification methods are promoted from the embedded interface.
type fakeHost struct {
	web.HostService

	mu         sync.Mutex
	containers []container.Container
	eventCh    chan<- container.ContainerEvent
	statCh     chan<- container.ContainerStat
	hostCh     chan<- container.Host
}

func newFakeHost() *fakeHost {
	return &fakeHost{containers: fixture()}
}

func (f *fakeHost) addContainer(c container.Container) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.containers = append(f.containers, c)
}

func (f *fakeHost) snapshot(labels container.ContainerLabels) []container.Container {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]container.Container, 0, len(f.containers))
	for _, c := range f.containers {
		if matchesLabels(c, labels) {
			out = append(out, c)
		}
	}
	return out
}

func (f *fakeHost) ListAllContainers(labels container.ContainerLabels) ([]container.Container, []error) {
	return f.snapshot(labels), nil
}

func (f *fakeHost) ListAllContainersFiltered(labels container.ContainerLabels, filter container_support.ContainerFilter) ([]container.Container, []error) {
	all := f.snapshot(labels)
	out := make([]container.Container, 0, len(all))
	for i := range all {
		if filter(&all[i]) {
			out = append(out, all[i])
		}
	}
	return out, nil
}

func (f *fakeHost) ListContainersForHost(host string, labels container.ContainerLabels) ([]container.Container, error) {
	all := f.snapshot(labels)
	out := make([]container.Container, 0, len(all))
	for _, c := range all {
		if c.Host == host {
			out = append(out, c)
		}
	}
	return out, nil
}

func (f *fakeHost) FindContainer(host, id string, labels container.ContainerLabels) (*container_support.ContainerService, error) {
	for _, c := range f.snapshot(labels) {
		if c.Host == host && c.ID == id {
			stub := &stubClientService{logs: []*container.LogEvent{{
				RawMessage: "log-line-" + c.ID,
				Timestamp:  time.Now().UnixMilli(),
				Level:      "info",
				Stream:     "stdout",
			}}}
			return container_support.NewContainerService(stub, c), nil
		}
	}
	return nil, fmt.Errorf("container %s not found", id)
}

func (f *fakeHost) Hosts() []container.Host {
	return []container.Host{
		{ID: "hostA", Name: "hostA", Available: true},
		{ID: "hostB", Name: "hostB", Available: true},
	}
}

func (f *fakeHost) LocalHost() (container.Host, error) {
	return container.Host{ID: "hostA", Name: "hostA", Available: true}, nil
}

func (f *fakeHost) LocalClients() []container.Client { return nil }

func (f *fakeHost) LocalClientServices() []container_support.ClientService { return nil }

func (f *fakeHost) SubscribeEventsAndStats(ctx context.Context, events chan<- container.ContainerEvent, stats chan<- container.ContainerStat) {
	f.mu.Lock()
	f.eventCh = events
	f.statCh = stats
	f.mu.Unlock()
}

func (f *fakeHost) SubscribeAvailableHosts(ctx context.Context, hosts chan<- container.Host) {
	f.mu.Lock()
	f.hostCh = hosts
	f.mu.Unlock()
}

func (f *fakeHost) SubscribeContainersStarted(ctx context.Context, containers chan<- container.Container, filter container_support.ContainerFilter) {
}

func (f *fakeHost) emitEvent(ev container.ContainerEvent) error {
	f.mu.Lock()
	ch := f.eventCh
	f.mu.Unlock()
	if ch == nil {
		return fmt.Errorf("event channel is not subscribed yet")
	}
	select {
	case ch <- ev:
		return nil
	case <-time.After(3 * time.Second):
		return fmt.Errorf("timed out handing an event to the server")
	}
}

func (f *fakeHost) emitStat(stat container.ContainerStat) error {
	f.mu.Lock()
	ch := f.statCh
	f.mu.Unlock()
	if ch == nil {
		return fmt.Errorf("stat channel is not subscribed yet")
	}
	select {
	case ch <- stat:
		return nil
	case <-time.After(3 * time.Second):
		return fmt.Errorf("timed out handing a stat to the server")
	}
}

// stubClientService answers log requests with no events; container data is
// already carried by the ContainerService the fake host returned.
type stubClientService struct {
	container_support.ClientService
	logs []*container.LogEvent
}

func (s *stubClientService) LogsBetweenDates(ctx context.Context, _ container.Container, _ time.Time, _ time.Time, _ container.StdType) (<-chan *container.LogEvent, error) {
	ch := make(chan *container.LogEvent, len(s.logs))
	for _, ev := range s.logs {
		ch <- ev
	}
	close(ch)
	return ch, nil
}

func (s *stubClientService) RawLogs(context.Context, container.Container, time.Time, time.Time, container.StdType) (io.ReadCloser, error) {
	return nil, fmt.Errorf("not implemented")
}

// newTestServer builds the product's real router with forward-proxy auth.
func newTestServer(t *testing.T, host *fakeHost, cfg web.Config) *httptest.Server {
	t.Helper()
	if cfg.Base == "" {
		cfg.Base = "/"
	}
	cfg.NoAnalytics = true
	cfg.Authorization = web.Authorization{
		Provider:   web.FORWARD_PROXY,
		Authorizer: auth.NewForwardProxyAuth("Remote-User", "Remote-Email", "Remote-Name", "Remote-Filter", "Remote-Roles"),
	}
	server := web.CreateServer(host, nil, cfg)
	ts := httptest.NewServer(server.Handler)
	t.Cleanup(ts.Close)
	return ts
}

// setIdentity attaches the real forward-proxy identity headers. An empty filter
// means the caller is unrestricted.
func setIdentity(req *http.Request, filter string) {
	req.Header.Set("Remote-User", "alice")
	req.Header.Set("Remote-Email", "alice@example.com")
	req.Header.Set("Remote-Name", "Alice")
	req.Header.Set("Remote-Roles", "")
	if filter == "" {
		req.Header.Del("Remote-Filter")
	} else {
		req.Header.Set("Remote-Filter", filter)
	}
}

// --- event feed --------------------------------------------------------------

type sseStream struct {
	cancel context.CancelFunc
	resp   *http.Response
	done   chan struct{}

	mu  sync.Mutex
	buf strings.Builder
}

func startStream(t *testing.T, ts *httptest.Server, filter string) *sseStream {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL+"/api/events/stream", nil)
	if err != nil {
		cancel()
		t.Fatalf("build the event feed request: %v", err)
	}
	setIdentity(req, filter)
	resp, err := ts.Client().Do(req)
	if err != nil {
		cancel()
		t.Fatalf("open the event feed: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		cancel()
		t.Fatalf("event feed returned %d: %s", resp.StatusCode, body)
	}

	s := &sseStream{cancel: cancel, resp: resp, done: make(chan struct{})}
	go func() {
		defer close(s.done)
		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 64*1024), 2*1024*1024)
		for scanner.Scan() {
			s.mu.Lock()
			s.buf.WriteString(scanner.Text())
			s.buf.WriteString("\n")
			s.mu.Unlock()
		}
	}()

	// The initial container list is written before the handler starts forwarding
	// channel traffic; once it is on the wire the subscription is live.
	if !s.wait(func(body string) bool { return strings.Contains(body, "event: containers-changed") }, 5*time.Second) {
		s.stop()
		t.Fatalf("the event feed never delivered the initial container list")
	}
	return s
}

func (s *sseStream) text() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.buf.String()
}

func (s *sseStream) wait(cond func(string) bool, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for {
		if cond(s.text()) {
			return true
		}
		if time.Now().After(deadline) {
			return cond(s.text())
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// waitEventID waits until the feed contains the named event whose payload
// mentions id. It is the positive control each security test needs: a fix that
// drops all traffic fails it rather than passing by silence.
func (s *sseStream) waitEventID(event, id string, timeout time.Duration) bool {
	pattern := regexp.MustCompile(`(?m)^event: ` + regexp.QuoteMeta(event) + `\ndata: [^\n]*` + regexp.QuoteMeta(id))
	return s.wait(func(body string) bool { return pattern.MatchString(body) }, timeout)
}

func (s *sseStream) stop() {
	s.cancel()
	_ = s.resp.Body.Close()
	<-s.done
}

// waitEventIDOrFail is the assertion every security test makes after the visible
// sentinel: the sentinel must have arrived, and the hidden identifier must not
// appear anywhere in what the caller was sent.
func waitEventIDOrFail(t *testing.T, s *sseStream, event, id string) {
	t.Helper()
	if !s.waitEventID(event, id, 5*time.Second) {
		s.stop()
		t.Fatalf("a permitted container's %s was not delivered (the fix must not drop it); feed:\n%s", event, s.text())
	}
}

func assertAbsent(t *testing.T, body, marker, what string) {
	t.Helper()
	if strings.Contains(body, marker) {
		t.Fatalf("%s: the response carried data about an out-of-scope container (%q); response:\n%s", what, marker, body)
	}
}

// --- JSON endpoints ----------------------------------------------------------

func doJSON(t *testing.T, ts *httptest.Server, method, path, payload, filter string) (int, string) {
	t.Helper()
	var body io.Reader
	if payload != "" {
		body = strings.NewReader(payload)
	}
	req, err := http.NewRequest(method, ts.URL+path, body)
	if err != nil {
		t.Fatalf("build %s %s: %v", method, path, err)
	}
	if payload != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	setIdentity(req, filter)
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read %s %s: %v", method, path, err)
	}
	return resp.StatusCode, string(out)
}

// --- MCP ---------------------------------------------------------------------

type identityTransport struct {
	base   http.RoundTripper
	filter string
}

func (t *identityTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	clone := req.Clone(req.Context())
	setIdentity(clone, t.filter)
	return t.base.RoundTrip(clone)
}

func mcpHTTPClient(filter string) *http.Client {
	return &http.Client{Transport: &identityTransport{base: http.DefaultTransport, filter: filter}}
}

func mcpConnect(t *testing.T, ts *httptest.Server, filter string) (*mcp.ClientSession, error) {
	t.Helper()
	client := mcp.NewClient(&mcp.Implementation{Name: "vtesting", Version: "0.0.1"}, nil)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	t.Cleanup(cancel)
	return client.Connect(ctx, &mcp.StreamableClientTransport{
		Endpoint:             ts.URL + "/api/mcp",
		HTTPClient:           mcpHTTPClient(filter),
		DisableStandaloneSSE: true,
	}, nil)
}

// mcpRawInitializeStatus reports the HTTP status of a raw MCP initialize
// request, so a transport-level refusal can be told apart from a server fault.
func mcpRawInitializeStatus(t *testing.T, ts *httptest.Server, filter string) int {
	t.Helper()
	const payload = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"vtesting","version":"0.0.1"}}}`
	req, err := http.NewRequest(http.MethodPost, ts.URL+"/api/mcp", strings.NewReader(payload))
	if err != nil {
		t.Fatalf("build MCP initialize: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	setIdentity(req, filter)
	resp, err := ts.Client().Do(req)
	if err != nil {
		t.Fatalf("MCP initialize: %v", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	return resp.StatusCode
}

func mcpCall(ctx context.Context, session *mcp.ClientSession, name string, args map[string]any) (*mcp.CallToolResult, error) {
	return session.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: args})
}

func mcpText(res *mcp.CallToolResult) string {
	if res == nil {
		return ""
	}
	var b strings.Builder
	for _, content := range res.Content {
		if text, ok := content.(*mcp.TextContent); ok {
			b.WriteString(text.Text)
			b.WriteString("\n")
		}
	}
	return b.String()
}

// --- debug view --------------------------------------------------------------

// withDebugLogging mounts routes that the product only registers when debug
// logging is enabled, and restores the previous level when the test ends.
func withDebugLogging(t *testing.T) {
	t.Helper()
	previous := zerolog.GlobalLevel()
	zerolog.SetGlobalLevel(zerolog.DebugLevel)
	t.Cleanup(func() { zerolog.SetGlobalLevel(previous) })
}
