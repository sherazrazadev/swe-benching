// Hidden functional suite for the tilt-s2 task.
package server_test

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/tilt-dev/tilt/internal/hud/client"
	"github.com/tilt-dev/tilt/internal/store"
	"github.com/tilt-dev/tilt/pkg/logger"
	"github.com/tilt-dev/tilt/pkg/model"
)

// A client that holds the session credential in the conventional header can
// read the view.
func TestFunc_ViewWithHeaderCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/view", map[string]string{"X-Tilt-Token": stkSessionToken})
	require.Equal(t, http.StatusOK, code, body)
	require.Contains(t, body, "isComplete")
}

// A browser that holds the session credential in its cookie can read the view.
func TestFunc_ViewWithCookieCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.do(http.MethodGet, "/api/view", "", nil, &http.Cookie{Name: "Tilt-Token", Value: stkSessionToken})
	require.Equal(t, http.StatusOK, code, body)
	require.Contains(t, body, "isComplete")
}

// The engine dump remains available to an authorized caller.
func TestFunc_DumpEngineWithCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/dump/engine", map[string]string{"X-Tilt-Token": stkSessionToken})
	require.Equal(t, http.StatusOK, code, body)
	require.Contains(t, body, "ManifestTargets")
}

// An authorized trigger still queues the update.
func TestFunc_TriggerWithCredentialDispatches(t *testing.T) {
	f := stkNewServer(t).withManifests("foo")
	code, body, _ := f.post("/api/trigger", `{"manifest_names":["foo"]}`, map[string]string{
		"Content-Type": "application/json",
		"X-Tilt-Token": stkSessionToken,
	})
	require.Equal(t, http.StatusOK, code, body)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		for _, a := range f.getActions() {
			if act, ok := a.(store.AppendToTriggerQueueAction); ok && act.Name == "foo" {
				return
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("an authorized trigger did not queue the update")
}

// Browser traffic declares the origin it was sent to and still works.
func TestFunc_SameOriginWithCredentialAllowed(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/view", map[string]string{
		"X-Tilt-Token": stkSessionToken,
		"Origin":       f.origin(),
	})
	require.Equal(t, http.StatusOK, code, body)
	require.Contains(t, body, "isComplete")
}

// Command-line clients send no origin and still work with the credential.
func TestFunc_NoOriginWithCredentialAllowed(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/dump/engine", map[string]string{"X-Tilt-Token": stkSessionToken})
	require.Equal(t, http.StatusOK, code, body)
}

// The first visit to the UI still hands the browser the session credential,
// and that credential authorizes the next request.
func TestFunc_FirstPageLoadHandsCredential(t *testing.T) {
	f := stkNewServer(t)
	code, _, hdr := f.get("/", nil)
	require.Equal(t, http.StatusOK, code)
	cookies := (&http.Response{Header: hdr}).Cookies()
	var tok *http.Cookie
	for _, c := range cookies {
		if c.Name == "Tilt-Token" {
			tok = c
		}
	}
	require.NotNil(t, tok, "the first page load must hand the browser a session credential")
	require.NotEmpty(t, tok.Value)
	code, body, _ := f.do(http.MethodGet, "/api/view", "", nil, tok)
	require.Equal(t, http.StatusOK, code, body)
}

// The product's own log client still receives the live stream from an
// authorized session.
func TestFunc_WebsocketStreamWithCredential(t *testing.T) {
	f := stkNewServer(t)
	u, err := url.Parse(f.srv.URL)
	require.NoError(t, err)
	filter := client.NewLogFilter(client.FilterSourceAll, nil, client.FilterLevel(logger.InfoLvl), client.FilterSince(time.Time{}), client.FilterTail(-1), false)
	streamer := client.NewLogStreamer(false, model.WebURL(*u), filter, client.ProvideLogPrinter(filter, client.ProvideStdout()))
	ctx, cancel := context.WithTimeout(f.ctx, 5*time.Second)
	defer cancel()
	require.NoError(t, streamer.Stream(ctx), "the session's log client must still be able to follow the live stream")
}

// The command-line trigger command still works against a running session.
func TestFunc_CLITriggerAgainstSession(t *testing.T) {
	f := stkNewServer(t).withManifests("foo")
	host, port := f.address()
	out, err := stkRunTilt(t, f, "trigger", "--host", host, "--port", port, "foo")
	require.NoError(t, err, "tilt trigger failed: %s", out)
	require.Contains(t, out, "Successfully triggered")
}

// The command-line view dump still works against a running session.
func TestFunc_CLIDumpWebviewAgainstSession(t *testing.T) {
	f := stkNewServer(t)
	host, port := f.address()
	out, err := stkRunTilt(t, f, "dump", "webview", "--host", host, "--port", port)
	require.NoError(t, err, "tilt dump webview failed: %s", out)
	require.Contains(t, out, "isComplete")
}

// The command-line status summary still works against a running session.
func TestFunc_CLIStatusAgainstSession(t *testing.T) {
	f := stkNewServer(t)
	host, port := f.address()
	out, err := stkRunTilt(t, f, "status", "--host", host, "--port", port)
	require.NoError(t, err, "tilt status failed: %s", out)
	require.Contains(t, strings.ToLower(out), "resources")
}

// An authorized caller still reaches the Kubernetes API state through the
// session.
func TestFunc_ProxyWithCredential(t *testing.T) {
	w := stkNewWired(t)
	code, body := w.get("/proxy/apis/tilt.dev/v1alpha1/uibuttons", map[string]string{"X-Tilt-Token": stkSessionToken})
	require.Equal(t, http.StatusOK, code, body)
	require.Contains(t, body, "UIButtonList")
}

// The old view surface still serves an authorized script.
func TestFunc_LegacyViewWithCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/v0/view", map[string]string{"X-Tilt-Token": stkSessionToken})
	require.Equal(t, http.StatusOK, code, body)
	require.Contains(t, body, "isComplete")
}

// The alternate API prefix still serves an authorized caller.
func TestFunc_SecondaryProxyWithCredential(t *testing.T) {
	w := stkNewWired(t)
	code, body := w.get("/k8s/apis/tilt.dev/v1alpha1/uibuttons", map[string]string{"X-Tilt-Token": stkSessionToken})
	require.Equal(t, http.StatusOK, code, body)
	require.Contains(t, body, "UIButtonList")
}

// An authorized Tiltfile-args update still reaches the API server.
func TestFunc_SetTiltfileArgsWithCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.post("/api/set_tiltfile_args", `["--foo","bar"]`, map[string]string{
		"Content-Type": "application/json",
		"X-Tilt-Token": stkSessionToken,
	})
	require.Equal(t, http.StatusOK, code, body)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if strings.Join(f.stkTiltfileArgs(), ",") == "--foo,bar" {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("an authorized Tiltfile-args update did not reach the API server: %v", f.stkTiltfileArgs())
}
