// Hidden support harness for the tilt-s2 task. Copied into internal/hud/server at
// grading time and used only by the TestSec_/TestFunc_ suites.
package server_test

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tilt-dev/wmclient/pkg/analytics"
	"github.com/tilt-dev/wmclient/pkg/dirs"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/tilt-dev/tilt-apiserver/pkg/server/testdata"
	tiltanalytics "github.com/tilt-dev/tilt/internal/analytics"
	"github.com/tilt-dev/tilt/internal/controllers/fake"
	"github.com/tilt-dev/tilt/internal/hud/server"
	"github.com/tilt-dev/tilt/internal/store"
	"github.com/tilt-dev/tilt/internal/testutils"
	"github.com/tilt-dev/tilt/internal/testutils/tempdir"
	"github.com/tilt-dev/tilt/internal/token"
	"github.com/tilt-dev/tilt/pkg/apis/core/v1alpha1"
	"github.com/tilt-dev/tilt/pkg/assets"
	"github.com/tilt-dev/tilt/pkg/model"
)

// The session credential the fixtures install. It is an arbitrary marker, not a
// product constant.
const stkSessionToken = "stk-6b1f-session-token"

type stkFixture struct {
	t          *testing.T
	ctx        context.Context
	serv       *server.HeadsUpServer
	st         *store.Store
	getActions func() []store.Action
	ctrlClient ctrlclient.Client
	srv        *httptest.Server
	dir        string
}

// stkNewServer builds the real HUD server around a real store, a fake API
// client and a session token, and serves it on a real TCP listener.
func stkNewServer(t *testing.T) *stkFixture {
	t.Helper()
	ctx, _, _ := testutils.CtxAndAnalyticsForTest()
	ctx, cancel := context.WithCancel(ctx)
	t.Cleanup(cancel)

	st, getActions := store.NewStoreWithFakeReducer()
	go func() { _ = st.Loop(ctx) }()
	_, ta := tiltanalytics.NewMemoryTiltAnalyticsForTest(tiltanalytics.NewFakeOpter(analytics.OptIn))
	ctrlClient := fake.NewFakeTiltClient()
	require.NoError(t, ctrlClient.Create(ctx, &v1alpha1.Tiltfile{
		ObjectMeta: metav1.ObjectMeta{Name: model.MainTiltfileManifestName.String()},
	}))

	serv, err := server.ProvideHeadsUpServer(ctx, st, assets.NewFakeServer(), ta, server.NewWebsocketList(), ctrlClient)
	require.NoError(t, err)

	state := st.LockMutableStateForTesting()
	state.Token = token.Token(stkSessionToken)
	st.UnlockMutableState()

	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "token"), []byte(stkSessionToken), 0700))
	t.Setenv("TILT_DEV_DIR", dir)
	t.Setenv("TILT_DISABLE_HUD_AUTH", "")

	srv := httptest.NewServer(serv.Router())
	t.Cleanup(srv.Close)

	return &stkFixture{t: t, ctx: ctx, serv: serv, st: st, getActions: getActions,
		ctrlClient: ctrlClient, srv: srv, dir: dir}
}

func (f *stkFixture) withManifests(names ...string) *stkFixture {
	state := f.st.LockMutableStateForTesting()
	for _, n := range names {
		mt := store.NewManifestTarget(model.Manifest{Name: model.ManifestName(n)})
		state.UpsertManifestTarget(mt)
	}
	f.st.UnlockMutableState()
	return f
}

func (f *stkFixture) do(method, path, body string, hdr map[string]string, cookie *http.Cookie) (int, string, http.Header) {
	var rdr io.Reader
	if body != "" {
		rdr = strings.NewReader(body)
	}
	req, err := http.NewRequest(method, f.srv.URL+path, rdr)
	require.NoError(f.t, err)
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	c := &http.Client{Timeout: 10 * time.Second}
	res, err := c.Do(req)
	require.NoError(f.t, err)
	defer func() { _ = res.Body.Close() }()
	b, err := io.ReadAll(res.Body)
	require.NoError(f.t, err)
	return res.StatusCode, string(b), res.Header
}

func (f *stkFixture) get(path string, hdr map[string]string) (int, string, http.Header) {
	return f.do(http.MethodGet, path, "", hdr, nil)
}

func (f *stkFixture) post(path, body string, hdr map[string]string) (int, string, http.Header) {
	if hdr == nil {
		hdr = map[string]string{"Content-Type": "application/json"}
	}
	return f.do(http.MethodPost, path, body, hdr, nil)
}

func (f *stkFixture) wsURL(path string) string {
	return "ws" + strings.TrimPrefix(f.srv.URL, "http") + path
}

func (f *stkFixture) origin() string {
	u, err := url.Parse(f.srv.URL)
	require.NoError(f.t, err)
	return u.Scheme + "://" + u.Host
}

func (f *stkFixture) address() (string, string) {
	u, err := url.Parse(f.srv.URL)
	require.NoError(f.t, err)
	host, port, err := net.SplitHostPort(u.Host)
	require.NoError(f.t, err)
	return host, port
}

// requireNoAction polls the store's action log for a short while and fails if
// the given action type was dispatched.
func (f *stkFixture) requireNoAction(typ reflect.Type) {
	f.t.Helper()
	deadline := time.Now().Add(400 * time.Millisecond)
	for time.Now().Before(deadline) {
		for _, a := range f.getActions() {
			if reflect.TypeOf(a) == typ {
				f.t.Fatalf("a refused request still dispatched %s: %+v", typ.Name(), a)
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// stkRequireRefused asserts the refusal contract: a client error, not a crash
// and not a success.
func stkRequireRefused(t *testing.T, code int, body string) {
	t.Helper()
	require.GreaterOrEqual(t, code, 400, "a request without a valid session credential must be refused, got %d (%s)", code, body)
	require.Less(t, code, 500, "the refusal must be a client error, not a server fault, got %d (%s)", code, body)
}

// stkRunTilt runs the tilt binary built from the workspace.
func stkRunTilt(t *testing.T, f *stkFixture, args ...string) (string, error) {
	t.Helper()
	bin := os.Getenv("STK_TILT_BIN")
	if bin == "" {
		bin = "/workspace/.htests/bin/tilt"
	}
	cmd := exec.Command(bin, args...)
	cmd.Env = append(os.Environ(),
		"TILT_DEV_DIR="+f.dir,
		"HOME="+t.TempDir(),
		"TILT_DISABLE_HUD_AUTH=",
	)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// stkWired is a fully wired HUD controller (real tilt-apiserver over a
// loopback in-memory connection) serving the web listener.
type stkWired struct {
	t       *testing.T
	ctx     context.Context
	webAddr string
}

func stkNewWired(t *testing.T) *stkWired {
	t.Helper()
	tmp := tempdir.NewTempDirFixture(t)
	dir := dirs.NewTiltDevDirAt(tmp.Path())
	ctx, _, _ := testutils.CtxAndAnalyticsForTest()
	ctx, cancel := context.WithCancel(ctx)
	t.Cleanup(cancel)

	memconn := server.ProvideMemConn()
	cfg, err := server.ProvideTiltServerOptions(ctx, model.TiltBuild{}, memconn, "corgi-charge", testdata.CertKey(), 0)
	require.NoError(t, err)
	webListener, err := server.ProvideWebListener("localhost", 0)
	require.NoError(t, err)
	t.Cleanup(func() { _ = webListener.Close() })
	configAccess := server.ProvideConfigAccess(dir)

	st, _ := store.NewStoreWithFakeReducer()
	go func() { _ = st.Loop(ctx) }()
	state := st.LockMutableStateForTesting()
	state.Token = token.Token(stkSessionToken)
	st.UnlockMutableState()

	_, ta := tiltanalytics.NewMemoryTiltAnalyticsForTest(tiltanalytics.NewFakeOpter(analytics.OptIn))
	hudServer, err := server.ProvideHeadsUpServer(ctx, st, assets.NewFakeServer(), ta, server.NewWebsocketList(), fake.NewFakeTiltClient())
	require.NoError(t, err)
	u, err := url.Parse(fmt.Sprintf("http://%s/", webListener.Addr().String()))
	require.NoError(t, err)
	hudsc := server.ProvideHeadsUpServerController(configAccess, "tilt-default", webListener, cfg, hudServer, assets.NewFakeServer(), model.WebURL(*u))
	require.NoError(t, hudsc.SetUp(ctx, st))
	t.Cleanup(func() { hudsc.TearDown(ctx) })

	return &stkWired{t: t, ctx: ctx, webAddr: webListener.Addr().String()}
}

func (w *stkWired) get(path string, hdr map[string]string) (int, string) {
	w.t.Helper()
	c := &http.Client{Timeout: 10 * time.Second}
	var code int
	var body string
	for i := 0; i < 60; i++ {
		req, err := http.NewRequest(http.MethodGet, "http://"+w.webAddr+path, nil)
		require.NoError(w.t, err)
		for k, v := range hdr {
			req.Header.Set(k, v)
		}
		res, err := c.Do(req)
		if err == nil {
			b, rerr := io.ReadAll(res.Body)
			_ = res.Body.Close()
			require.NoError(w.t, rerr)
			code, body = res.StatusCode, string(b)
			if code != 0 && code < 500 {
				return code, body
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	w.t.Fatalf("web listener did not answer on %s", w.webAddr)
	return code, body
}

// stkTiltfileArgs reads the current Tiltfile args from the fake API client.
func (f *stkFixture) stkTiltfileArgs() []string {
	f.t.Helper()
	var tf v1alpha1.Tiltfile
	err := f.ctrlClient.Get(f.ctx, types.NamespacedName{Name: model.MainTiltfileManifestName.String()}, &tf)
	require.NoError(f.t, err)
	return tf.Spec.Args
}
