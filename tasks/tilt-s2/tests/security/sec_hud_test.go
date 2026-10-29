// Hidden security suite for the tilt-s2 task.
package server_test

import (
	"net/http"
	"reflect"
	"regexp"
	"testing"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"

	"github.com/tilt-dev/tilt/internal/hud/server"
	"github.com/tilt-dev/tilt/internal/store"
)

var stkUUID = regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}`)

// An unauthenticated caller must not read the current view.
func TestSec_ViewRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/view", nil)
	stkRequireRefused(t, code, body)
	require.NotContains(t, body, "isComplete", "a refused read must not return the view")
}

// An unauthenticated caller must not read the engine dump.
func TestSec_DumpEngineRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/dump/engine", nil)
	stkRequireRefused(t, code, body)
	require.NotContains(t, body, "ManifestTargets", "a refused read must not return the engine state")
}

// An unauthenticated caller must not read a snapshot.
func TestSec_SnapshotRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/snapshot/example", nil)
	stkRequireRefused(t, code, body)
	require.NotContains(t, body, "isComplete", "a refused read must not return the view")
}

// The value that authorizes the live stream must not be handed to a caller
// that does not hold the session credential.
func TestSec_WebsocketTokenRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/websocket_token", nil)
	stkRequireRefused(t, code, body)
	require.False(t, stkUUID.MatchString(body), "a refused request must not receive the stream credential: %q", body)
}

// A forged value is not the session credential.
func TestSec_ForgedHeaderCredentialRefused(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/view", map[string]string{"X-Tilt-Token": "not-the-session-credential"})
	stkRequireRefused(t, code, body)
	require.NotContains(t, body, "isComplete")
}

// A forged cookie is not the session credential.
func TestSec_ForgedCookieCredentialRefused(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.do(http.MethodGet, "/api/view", "", nil, &http.Cookie{Name: "Tilt-Token", Value: "not-the-session-credential"})
	stkRequireRefused(t, code, body)
	require.NotContains(t, body, "isComplete")
}

// A refused trigger must not queue an update.
func TestSec_TriggerRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t).withManifests("foo")
	code, body, _ := f.post("/api/trigger", `{"manifest_names":["foo"]}`, nil)
	stkRequireRefused(t, code, body)
	f.requireNoAction(reflect.TypeOf(store.AppendToTriggerQueueAction{}))
}

// A refused trigger-mode override must not change any resource.
func TestSec_OverrideTriggerModeRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t).withManifests("foo")
	code, body, _ := f.post("/api/override/trigger_mode", `{"manifest_names":["foo"], "trigger_mode": 1}`, nil)
	stkRequireRefused(t, code, body)
	f.requireNoAction(reflect.TypeOf(server.OverrideTriggerModeAction{}))
}

// A refused analytics choice must not change the session's analytics setting.
func TestSec_AnalyticsOptRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.post("/api/analytics_opt", `{"opt":"opt-in"}`, nil)
	stkRequireRefused(t, code, body)
	f.requireNoAction(reflect.TypeOf(store.AnalyticsUserOptAction{}))
}

// A refused Tiltfile-args update must not reach the API server.
func TestSec_SetTiltfileArgsRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.post("/api/set_tiltfile_args", `["--hostile","value"]`, nil)
	stkRequireRefused(t, code, body)
	require.Empty(t, f.stkTiltfileArgs(), "a refused request must not change the Tiltfile arguments")
}

// A valid credential does not authorize a request from another origin.
func TestSec_CrossOriginRequestRefusedEvenWithCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/view", map[string]string{
		"X-Tilt-Token": stkSessionToken,
		"Origin":       "http://attacker.example",
	})
	stkRequireRefused(t, code, body)
	require.NotContains(t, body, "isComplete")
}

// A client that presents no credential must not open the live stream, even
// when it omits the origin browsers would send.
func TestSec_WebsocketRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t)
	conn, resp, err := websocket.DefaultDialer.Dial(f.wsURL("/ws/view"), nil)
	if conn != nil {
		_ = conn.Close()
	}
	require.Error(t, err, "an unauthenticated client must not open the view stream")
	if resp != nil {
		require.NotEqual(t, http.StatusSwitchingProtocols, resp.StatusCode)
	}
}

// Declaring the same origin is not a credential.
func TestSec_WebsocketSameOriginWithoutCredentialRefused(t *testing.T) {
	f := stkNewServer(t)
	h := http.Header{"Origin": []string{f.origin()}}
	conn, resp, err := websocket.DefaultDialer.Dial(f.wsURL("/ws/view"), h)
	if conn != nil {
		_ = conn.Close()
	}
	require.Error(t, err, "same-origin alone must not open the view stream without a credential")
	if resp != nil {
		require.NotEqual(t, http.StatusSwitchingProtocols, resp.StatusCode)
	}
}

// The Kubernetes API state reachable through the session needs the credential.
func TestSec_ProxyRequiresSessionCredential(t *testing.T) {
	w := stkNewWired(t)
	code, body := w.get("/proxy/apis/tilt.dev/v1alpha1/uibuttons", nil)
	stkRequireRefused(t, code, body)
	require.NotContains(t, body, "UIButtonList", "a refused request must not return API state")
}

// The old API surface is part of the session's state, and a forged value is
// not the credential even on an endpoint that asks for one.
func TestSec_LegacyViewRejectsForgedCredential(t *testing.T) {
	f := stkNewServer(t)
	code, body, _ := f.get("/api/v0/view", map[string]string{"X-Tilt-Token": "forged-value"})
	stkRequireRefused(t, code, body)
	require.NotContains(t, body, "isComplete")
}

// The old trigger surface must not queue an update for an unauthenticated
// caller.
func TestSec_LegacyTriggerRequiresSessionCredential(t *testing.T) {
	f := stkNewServer(t).withManifests("foo")
	code, body, _ := f.post("/api/v0/trigger", `{"manifest_names":["foo"]}`, nil)
	stkRequireRefused(t, code, body)
	f.requireNoAction(reflect.TypeOf(store.AppendToTriggerQueueAction{}))
}

// The alternate prefix for the same API state needs the credential too.
func TestSec_SecondaryProxyRequiresSessionCredential(t *testing.T) {
	w := stkNewWired(t)
	code, body := w.get("/k8s/apis/tilt.dev/v1alpha1/uibuttons", nil)
	stkRequireRefused(t, code, body)
	require.NotContains(t, body, "UIButtonList", "a refused request must not return API state")
}
