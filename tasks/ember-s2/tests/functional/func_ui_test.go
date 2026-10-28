package ui

import (
	"context"
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

const (
	funcMarker = "ZQPWN"
	funcEvil   = "\x1b]0;" + funcMarker + "\x07"
)

// TestFunctionalMachineFilterKeepsRawValue proves the typed filter still
// matches the values exactly as the log line carried them; cleaning happens
// only where a value is drawn.
func TestFunctionalMachineFilterKeepsRawValue(t *testing.T) {
	uri := "/orders?ref=" + funcMarker + funcEvil
	buf := model.NewLogBuffer(16)
	buf.Append(fetcher.LogEntry{
		Timestamp: time.Now(),
		Logger:    "http.log.access.log0",
		Host:      "shop.example",
		Method:    "GET",
		URI:       uri,
		Status:    200,
	})
	app := secLogsApp(buf, model.NewLogBuffer(16))
	app.filter = funcEvil

	got := app.filteredLogEntries()
	if len(got) != 1 {
		t.Fatalf("a filter carrying the raw value matched %d rows, want 1; the raw value was altered", len(got))
	}
	if got[0].URI != uri {
		t.Fatalf("filtered row URI = %q, want the untouched %q", got[0].URI, uri)
	}
}

// TestFunctionalCertificateSortAndFilterKeepRaw proves certificate ordering
// and filtering still read the values as they arrived.
func TestFunctionalCertificateSortAndFilterKeepRaw(t *testing.T) {
	rawIssuer := "issu" + funcEvil + "er"
	certs := []fetcher.CertificateInfo{
		{Subject: "b.example", Issuer: "zzz-issuer", NotAfter: time.Now().Add(72 * time.Hour), Source: "tls"},
		{Subject: "a.example", Issuer: rawIssuer, NotAfter: time.Now().Add(72 * time.Hour), Source: "tls"},
	}
	sorted := sortCerts(certs, model.SortByCertIssuer)
	if sorted[0].Issuer != rawIssuer {
		t.Fatalf("certificate sort changed the raw issuer: got %q, want %q", sorted[0].Issuer, rawIssuer)
	}

	app := NewApp(nil, Config{})
	app.certificates = certs
	app.filter = rawIssuer
	matched := app.filteredCerts()
	if len(matched) != 1 || matched[0].Issuer != rawIssuer {
		t.Fatalf("certificate filter matched %d certificates, want the one whose raw issuer contains the query", len(matched))
	}
}

// TestFunctionalPrintableWidthPreserved covers the display-cell contract for
// the values a quick hardening is most likely to mangle.
func TestFunctionalPrintableWidthPreserved(t *testing.T) {
	if got := fitCellLeft("🚀", 4); got != "🚀  " {
		t.Fatalf("emoji cell = %q, want it kept and counted as two cells", got)
	}
	if got := fitCellLeft("日本語", 6); got != "日本語" {
		t.Fatalf("CJK cell = %q, want it unchanged", got)
	}
	if got := fitCellRight("🚀", 4); got != "  🚀" {
		t.Fatalf("right-aligned emoji cell = %q, want two left pads", got)
	}

	buf := model.NewLogBuffer(16)
	buf.Append(secAccessEntry("日本語.example", "GET", "/🚀/café"))
	app := secLogsApp(buf, model.NewLogBuffer(16))
	out := app.View()
	for _, want := range []string{"日本語.example", "/🚀/café"} {
		if !strings.Contains(out, want) {
			t.Fatalf("printable value %q was altered or dropped by the renderer", want)
		}
	}
}

// TestFunctionalCleanAccessRowUnchanged keeps ordinary rows byte-for-byte
// visible: the host, method and URI still appear as they were sent.
func TestFunctionalCleanAccessRowUnchanged(t *testing.T) {
	entry := secAccessEntry("shop.example.com", "POST", "/cart/add?item=42")
	buf := model.NewLogBuffer(16)
	buf.Append(entry)
	app := secLogsApp(buf, model.NewLogBuffer(16))
	out := app.View()
	for _, want := range []string{"shop.example.com", "POST", "/cart/add?item=42"} {
		if !strings.Contains(out, want) {
			t.Fatalf("clean value %q no longer renders", want)
		}
	}
}

// TestFunctionalLogDetailClean keeps the detail panel's request label intact
// for an ordinary request.
func TestFunctionalLogDetailClean(t *testing.T) {
	line := `{"level":"info","logger":"http.log.access.log0","msg":"handled",` +
		`"request":{"method":"GET","host":"shop.example","uri":"/cart?x=1"},"status":200,"duration":0.02}`
	buf := model.NewLogBuffer(16)
	buf.Append(fetcher.ParseLogLine(line))
	app := secLogsApp(buf, model.NewLogBuffer(16))
	app.logSel = logSel{kind: logSelAccess}
	app.logSidepanelFocused = false
	app.cursor = 0
	app.mode = viewDetail
	out := app.View()
	if !strings.Contains(out, "GET /cart?x=1") {
		t.Fatalf("the request label was changed for a clean request:\n%s", out)
	}
}

// TestFunctionalPluginTabClean keeps an ordinary plugin tab readable.
func TestFunctionalPluginTabClean(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("caddy_http_requests_total{host=\"shop.example.com\"} 7\n"))
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
	out := app.View()
	if !strings.Contains(out, "shop.example.com") {
		t.Fatalf("a clean host name no longer renders in the plugin tab:\n%s", out)
	}
	if strings.Count(out, "\n") < 3 {
		t.Fatalf("the plugin tab lost its line structure:\n%q", out)
	}
}

// TestFunctionalFrameKeepsLayout keeps the dashboard a multi-line frame: a
// fix that neutralises the assembled frame as one string would remove the
// line breaks the whole TUI is built from.
func TestFunctionalFrameKeepsLayout(t *testing.T) {
	buf := model.NewLogBuffer(16)
	buf.Append(secAccessEntry("shop.example.com", "GET", "/"))
	app := secLogsApp(buf, model.NewLogBuffer(16))
	out := app.View()
	if strings.Count(out, "\n") < 8 {
		t.Fatalf("the rendered frame collapsed to %d lines", strings.Count(out, "\n"))
	}
	if !strings.Contains(out, "│") {
		t.Fatalf("the sidepanel/table border is missing from the frame")
	}
}

// TestFunctionalPrintableNeighboursKeepTheirText ensures cleaning removes only
// the control code points, not the printable text around them.
func TestFunctionalPrintableNeighboursKeepTheirText(t *testing.T) {
	buf := model.NewLogBuffer(16)
	buf.Append(secAccessEntry("clean.example", "GET", "/before-"+funcMarker+"-after"))
	app := secLogsApp(buf, model.NewLogBuffer(16))
	out := app.View()
	if !strings.Contains(out, "before-"+funcMarker+"-after") {
		t.Fatalf("printable text around a control sequence changed: %q", out)
	}
}
