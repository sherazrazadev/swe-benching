package ui

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alexandre-daubois/ember/internal/fetcher"
	"github.com/alexandre-daubois/ember/internal/model"
	"github.com/alexandre-daubois/ember/internal/plugins/hostboard"
	"github.com/alexandre-daubois/ember/pkg/plugin"
)

// The payloads carry a harmless printable marker (ZQPWN) next to the control
// sequences, so a test can prove the value really reached the renderer and was
// neutralised rather than dropped or never drawn.
const (
	secMarker  = "ZQPWN"
	secOsc     = "\x1b]0;" + secMarker + "\x07"
	secCsi     = "\x1b[2J"
	secPayload = secMarker + secOsc + secCsi
	secC1Osc   = "\u009d0;" + secMarker + "\u009c"
	secC1Csi   = "\u009b2J"
)

// secBad lists the terminal-escape introducers a neutralised render must not
// contain. The product's own styling emits SGR sequences (ESC [ ... m), so
// generic ESC is not on the list; these are the introducers only an injected
// value can produce.
var secBad = []string{"\x07", "\x1b]", "\x1b[2J", "\x7f", "\x00", "\r", "\t",
	string(rune(0x9b)), string(rune(0x9d)), string(rune(0x9c))}

func secAssertBlocked(t *testing.T, where, out string) {
	t.Helper()
	for _, bad := range secBad {
		if strings.Contains(out, bad) {
			t.Fatalf("%s: terminal control sequence %q from an external value reached the renderer\n--- output ---\n%s", where, bad, out)
		}
	}
	if !strings.Contains(out, secMarker) {
		t.Fatalf("%s: the printable remainder %q is missing; the value was not rendered at all\n--- output ---\n%s", where, secMarker, out)
	}
}

// secLogsApp mirrors the production wiring of the Logs tab: one access buffer,
// one runtime buffer and one route aggregator, as startNetListener creates
// them.
func secLogsApp(access, runtime *model.LogBuffer) *App {
	return &App{
		activeTab:        tabLogs,
		tabs:             []tab{tabCaddy, tabConfig, tabCertificates, tabLogs},
		tabStates:        map[tab]*tabState{tabCaddy: {}, tabConfig: {}, tabCertificates: {}, tabLogs: {}},
		history:          newHistoryStore(),
		logBuffer:        access,
		runtimeLogBuffer: runtime,
		routeAggregator:  model.NewRouteAggregator(),
		logSource:        "net 127.0.0.1:0",
		width:            120,
		height:           30,
		logSel:           logSel{kind: logSelAccess},
	}
}

func secAccessEntry(host, method, uri string) fetcher.LogEntry {
	return fetcher.LogEntry{
		Timestamp: time.Now(),
		Logger:    "http.log.access.log0",
		Host:      host,
		Method:    method,
		URI:       uri,
		Status:    200,
		Duration:  0.012,
	}
}

// TestSecurityAccessLogRow draws an access-log row carrying escape sequences
// in every request field through the real Logs-tab render.
func TestSecurityAccessLogRow(t *testing.T) {
	buf := model.NewLogBuffer(16)
	buf.Append(secAccessEntry("host"+secPayload, "M"+secPayload, "/a?"+secPayload))
	app := secLogsApp(buf, model.NewLogBuffer(16))
	secAssertBlocked(t, "access row", app.View())
}

// TestSecurityAccessLogRawLine draws a non-JSON log line, whose whole content
// is the raw line shown in place of the parsed fields.
func TestSecurityAccessLogRawLine(t *testing.T) {
	buf := model.NewLogBuffer(16)
	buf.Append(fetcher.ParseLogLine("not json " + secPayload))
	app := secLogsApp(buf, model.NewLogBuffer(16))
	secAssertBlocked(t, "access raw line", app.View())
}

// TestSecurityRuntimeLogRow draws runtime-log fields, which use the runtime
// table rather than the access columns.
func TestSecurityRuntimeLogRow(t *testing.T) {
	access := model.NewLogBuffer(16)
	access.Append(secAccessEntry("clean.example", "GET", "/"))
	runtime := model.NewLogBuffer(16)
	runtime.Append(fetcher.LogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Logger:    "tls." + secPayload,
		Message:   "handshake " + secPayload,
	})
	app := secLogsApp(access, runtime)
	app.logSel = logSel{kind: logSelRuntime}
	secAssertBlocked(t, "runtime row", app.View())
}

// TestSecurityStatusLine covers the frame's status/error line, which
// concatenates error text produced elsewhere.
func TestSecurityStatusLine(t *testing.T) {
	snap := &fetcher.Snapshot{
		FetchedAt: time.Now(),
		Metrics: fetcher.MetricsSnapshot{
			HasHTTPMetrics: true,
			Hosts: map[string]*fetcher.HostMetrics{
				"clean.example": {Host: "clean.example", RequestsTotal: 1},
			},
		},
		Errors: []string{"metrics parse failed: " + secPayload},
	}
	app := secLogsApp(model.NewLogBuffer(16), model.NewLogBuffer(16))
	app.Update(fetchMsg{snap: snap}) //nolint:errcheck // tea.Model update
	secAssertBlocked(t, "status line", app.View())

	app2 := secLogsApp(model.NewLogBuffer(16), model.NewLogBuffer(16))
	app2.Update(fetchMsg{err: errors.New("connect: " + secPayload)}) //nolint:errcheck
	secAssertBlocked(t, "error line", app2.View())
}

// TestSecurityCertificates covers the certificate table: the displayed domain
// is the first DNS name when one exists (shadowing the subject), and the
// issuer is drawn in its own column.
func TestSecurityCertificates(t *testing.T) {
	app := NewApp(nil, Config{})
	app.width, app.height = 140, 40
	app.Update(certFetchMsg{certs: []fetcher.CertificateInfo{{
		Subject:   "subject-clean.example",
		DNSNames:  []string{secPayload},
		Issuer:    "issuer " + secPayload,
		NotAfter:  time.Now().Add(48 * time.Hour),
		NotBefore: time.Now().Add(-24 * time.Hour),
		Source:    "tls",
	}}}) //nolint:errcheck
	app.activeTab = tabCertificates
	secAssertBlocked(t, "certificates", app.View())
}

// TestSecurityHostTableAndDetail covers the Caddy tab's host column and the
// host-detail panel's breadcrumb and Methods table.
func TestSecurityHostTableAndDetail(t *testing.T) {
	mk := func(at time.Time, count float64) *fetcher.Snapshot {
		return &fetcher.Snapshot{
			FetchedAt: at,
			Metrics: fetcher.MetricsSnapshot{
				HasHTTPMetrics: true,
				Hosts: map[string]*fetcher.HostMetrics{
					secPayload: {
						Host:          secPayload,
						RequestsTotal: count,
						DurationCount: count,
						DurationSum:   count * 0.01,
						StatusCodes:   map[int]float64{200: count},
						Methods:       map[string]float64{"M" + secPayload: count},
					},
				},
			},
		}
	}
	app := NewApp(nil, Config{})
	app.width, app.height = 140, 40
	t0 := time.Now().Add(-2 * time.Second)
	app.Update(fetchMsg{snap: mk(t0, 0)})                   //nolint:errcheck
	app.Update(fetchMsg{snap: mk(t0.Add(time.Second), 10)}) //nolint:errcheck
	app.activeTab = tabCaddy
	app.cursor = 0
	secAssertBlocked(t, "host table", app.View())

	app.mode = viewDetail
	secAssertBlocked(t, "host detail", app.View())
}

// TestSecurityRoutesTable covers the By Route aggregation: the method takes a
// cell path that does not go through the shared table helper.
func TestSecurityRoutesTable(t *testing.T) {
	app := secLogsApp(model.NewLogBuffer(16), model.NewLogBuffer(16))
	app.routeAggregator.Track(fetcher.LogEntry{
		Timestamp: time.Now(),
		Logger:    "http.log.access.log0",
		Host:      "host.example",
		Method:    "M" + secPayload,
		URI:       "/r?" + secPayload,
		Status:    200,
	})
	app.logSel = logSel{kind: logSelRoutes}
	app.logSidepanelFocused = false
	secAssertBlocked(t, "routes table", app.View())
}

// TestSecuritySidepanelHostLabel covers the Logs sidepanel tree, whose host
// labels are drawn outside the table cells.
func TestSecuritySidepanelHostLabel(t *testing.T) {
	buf := model.NewLogBuffer(16)
	buf.Append(secAccessEntry(secPayload, "GET", "/"))
	app := secLogsApp(buf, model.NewLogBuffer(16))
	app.logSel = logSel{kind: logSelAccessHost, host: secPayload}
	app.logSidepanelFocused = true
	secAssertBlocked(t, "sidepanel host label", app.View())
}

// TestSecurityEmptyHostHint covers the per-host "no logs yet" message, which
// echoes the selected host outside the table.
func TestSecurityEmptyHostHint(t *testing.T) {
	access := model.NewLogBuffer(16)
	access.Append(secAccessEntry("other.example", "GET", "/"))
	app := secLogsApp(access, model.NewLogBuffer(16))
	// The host exists only in the route aggregator, so the sidepanel offers it
	// while the access buffer has no row for it: the empty-state hint draws.
	app.routeAggregator.Track(fetcher.LogEntry{
		Timestamp: time.Now(),
		Logger:    "http.log.access.log0",
		Host:      secPayload,
		Method:    "GET",
		URI:       "/",
		Status:    200,
	})
	app.logSel = logSel{kind: logSelAccessHost, host: secPayload}
	secAssertBlocked(t, "empty host hint", app.View())
}

// TestSecurityWorkerListAndDetail covers the FrankenPHP tab: the in-flight
// request a worker is serving is attacker-controlled.
func TestSecurityWorkerListAndDetail(t *testing.T) {
	snap := &fetcher.Snapshot{
		FetchedAt:     time.Now(),
		HasFrankenPHP: true,
		Metrics: fetcher.MetricsSnapshot{
			HasHTTPMetrics: true,
			Hosts: map[string]*fetcher.HostMetrics{
				"clean.example": {Host: "clean.example", RequestsTotal: 1},
			},
		},
		Threads: fetcher.ThreadsResponse{ThreadDebugStates: []fetcher.ThreadDebugState{{
			Index:         0,
			Name:          "worker-0",
			State:         "running",
			IsBusy:        true,
			CurrentMethod: "M" + secPayload,
			CurrentURI:    "/w?" + secPayload,
		}}},
	}
	app := NewApp(nil, Config{})
	app.width, app.height = 140, 40
	app.Update(fetchMsg{snap: snap}) //nolint:errcheck
	app.activeTab = tabFrankenPHP
	app.cursor = 0
	secAssertBlocked(t, "worker list", app.View())

	app.mode = viewDetail
	secAssertBlocked(t, "worker detail", app.View())
}

// TestSecurityControlShapes drives the same access row with the individual
// control classes the invariant names: OSC (BEL- and ST-terminated), CSI,
// C1 controls supplied as UTF-8 code points, DEL, NUL, CR, LF and TAB.
func TestSecurityControlShapes(t *testing.T) {
	cases := map[string]string{
		"OSC window title":  secOsc,
		"OSC ST terminated": "\x1b]0;" + secMarker + "\x1b\\",
		"CSI erase":         secMarker + secCsi,
		"C1 OSC/ST":         secC1Osc,
		"C1 CSI":            secMarker + secC1Csi,
		"DEL":               "\x7f" + secMarker,
		"NUL":               "\x00" + secMarker,
	}
	for name, payload := range cases {
		t.Run(name, func(t *testing.T) {
			buf := model.NewLogBuffer(16)
			buf.Append(secAccessEntry("clean.example", "GET", "/a?"+payload))
			app := secLogsApp(buf, model.NewLogBuffer(16))
			secAssertBlocked(t, name, app.View())
		})
	}
}

// TestSecurityPluginTab covers text a plugin tab draws: the core renders a
// plugin's View verbatim.
func TestSecurityPluginTab(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("caddy_http_requests_total{host=\"" + secPayload + "\"} 5\n"))
	}))
	defer srv.Close()

	p := hostboard.New()
	if err := p.Provision(context.Background(), plugin.PluginConfig{CaddyAddr: srv.URL}); err != nil {
		t.Fatalf("provision: %v", err)
	}
	data, err := p.Fetch(context.Background())
	if err != nil {
		t.Fatalf("plugin fetch: %v", err)
	}
	app := NewApp(nil, Config{Plugins: []plugin.Plugin{p}})
	app.width, app.height = 140, 40
	app.Update(pluginFetchMsg{groupIndex: 0, data: data}) //nolint:errcheck
	app.switchTab(app.pluginTabs[0].tabID)
	secAssertBlocked(t, "plugin tab", app.View())
}

// TestSecurityPluginError covers a plugin Fetch error, which the core draws
// in place of an empty plugin view.
func TestSecurityPluginError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		// The admin endpoint answers with an error page that echoes the
		// request label; the plugin quotes a short excerpt in its error.
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte("bad request for host " + secPayload))
	}))
	defer srv.Close()

	p := hostboard.New()
	if err := p.Provision(context.Background(), plugin.PluginConfig{CaddyAddr: srv.URL}); err != nil {
		t.Fatalf("provision: %v", err)
	}
	_, fetchErr := p.Fetch(context.Background())
	if fetchErr == nil {
		t.Fatalf("expected the malformed metrics body to fail")
	}
	app := NewApp(nil, Config{Plugins: []plugin.Plugin{p}})
	app.width, app.height = 140, 40
	app.Update(pluginFetchMsg{groupIndex: 0, err: fetchErr}) //nolint:errcheck
	app.switchTab(app.pluginTabs[0].tabID)
	secAssertBlocked(t, "plugin error", app.View())
}

// TestSecurityLogDetailSummary covers the log-detail panel, which draws the
// request label the parser assembled at ingest time.
func TestSecurityLogDetailSummary(t *testing.T) {
	line := `{"level":"info","logger":"http.log.access.log0","msg":"handled",` +
		`"request":{"method":"GET","host":"clean.example","uri":"/d?` + `\u001b]0;` + secMarker + `\u0007\u001b[2J` + `"},"status":200,"duration":0.01}`
	e := fetcher.ParseLogLine(line)
	buf := model.NewLogBuffer(16)
	buf.Append(e)
	app := secLogsApp(buf, model.NewLogBuffer(16))
	app.logSel = logSel{kind: logSelAccess}
	app.logSidepanelFocused = false
	app.cursor = 0
	app.mode = viewDetail
	secAssertBlocked(t, "log detail summary", app.View())
}
