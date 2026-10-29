package vtesting

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"go.senan.xyz/gonic/cache"
	"go.senan.xyz/gonic/db"
	"go.senan.xyz/gonic/deps"
	"go.senan.xyz/gonic/playlist"
	"go.senan.xyz/gonic/server/ctrlsubsonic"
)

// pngB64 is a 1x1 PNG: a real decodable image so a served cover is unmistakable.
const pngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC"

const (
	attrName   = "#GONIC-NAME:"
	attrPublic = "#GONIC-IS-PUBLIC:"
)

// harness drives the product's real HTTP API: ctrlsubsonic.New registers every route,
// including the login middleware, so each request is authenticated as the given user.
type harness struct {
	t     *testing.T
	c     *ctrlsubsonic.Controller
	dbc   *db.DB
	admin *db.User
	alt   *db.User
	root  string // temp root
	base  string // playlists storage area
}

type playlistView struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Comment   string `json:"comment"`
	Owner     string `json:"owner"`
	SongCount int    `json:"songCount"`
	Public    bool   `json:"public"`
}

type envelope struct {
	Response struct {
		Status    string `json:"status"`
		Error     *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
		Playlist  *playlistView `json:"playlist"`
		Playlists *struct {
			List []playlistView `json:"playlist"`
		} `json:"playlists"`
	} `json:"subsonic-response"`
}

func newHarness(t *testing.T) *harness {
	t.Helper()

	root := t.TempDir()
	base := filepath.Join(root, "playlists")
	if err := os.MkdirAll(base, 0o755); err != nil {
		t.Fatalf("make playlists dir: %v", err)
	}
	covers := filepath.Join(root, "covers")
	if err := os.MkdirAll(covers, 0o755); err != nil {
		t.Fatalf("make cover cache dir: %v", err)
	}

	dbc, err := db.NewMock(deps.DBDriverOptions())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = dbc.Close() })
	if err := dbc.Migrate(db.MigrationContext{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	admin := dbc.GetUserByName("admin")
	if admin == nil {
		t.Fatal("the fixture needs the migrated admin user")
	}
	alt := &db.User{Name: "alt", Password: "altpass"}
	if err := dbc.Create(alt).Error; err != nil {
		t.Fatalf("create second user: %v", err)
	}

	store, err := playlist.NewStore(base)
	if err != nil {
		t.Fatalf("open playlist store: %v", err)
	}
	contr, err := ctrlsubsonic.New(dbc, nil, nil, "", "", cache.New(covers, 10), nil, store,
		nil, nil, nil, nil, nil, nil, nil, nil)
	if err != nil {
		t.Fatalf("build controller: %v", err)
	}
	return &harness{t: t, c: contr, dbc: dbc, admin: admin, alt: alt, root: root, base: base}
}

// adminDir and altDir are the per-user directories the product lays playlists out under.
func (h *harness) adminDir() string { return strconv.Itoa(h.admin.ID) }
func (h *harness) altDir() string   { return strconv.Itoa(h.alt.ID) }

// writePlaylist lays down a playlist file straight in the storage area: the test computes
// its own fixtures, so a hardened product helper cannot change what the test expects.
func (h *harness) writePlaylist(rel, name, comment string, public bool) string {
	h.t.Helper()
	abs := filepath.Join(h.base, rel)
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		h.t.Fatalf("make playlist dir: %v", err)
	}
	body := attrName + strconv.Quote(name) + "\n"
	body += "#GONIC-COMMENT:" + strconv.Quote(comment) + "\n"
	body += attrPublic + strconv.Quote(strconv.FormatBool(public)) + "\n"
	if err := os.WriteFile(abs, []byte(body), 0o600); err != nil {
		h.t.Fatalf("write playlist: %v", err)
	}
	return abs
}

// encodeID renders a playlist identifier the way the Subsonic API carries it.
func encodeID(rel string) string {
	return "pl-" + base64.URLEncoding.EncodeToString([]byte(rel))
}

// do performs one authenticated request through the product's own HTTP server.
func (h *harness) do(user *db.User, op string, q url.Values) (*httptest.ResponseRecorder, envelope) {
	h.t.Helper()
	q.Set("u", user.Name)
	q.Set("p", user.Password)
	q.Set("c", "htest")
	q.Set("v", "1")
	q.Set("f", "json")
	req := httptest.NewRequest(http.MethodGet, "/"+op+"?"+q.Encode(), nil)
	rec := httptest.NewRecorder()
	h.c.ServeHTTP(rec, req)
	var env envelope
	_ = json.Unmarshal(rec.Body.Bytes(), &env)
	return rec, env
}

// decodeID reads back the relative path a Subsonic playlist identifier carries.
func decodeID(id string) string {
	const prefix = "pl-"
	if !strings.HasPrefix(id, prefix) {
		return ""
	}
	b, err := base64.URLEncoding.DecodeString(id[len(prefix):])
	if err != nil {
		return ""
	}
	return string(b)
}

// refused reports the product's refusal form: a Subsonic error response.
func refused(env envelope) bool {
	return env.Response.Status == "failed"
}

func pngBytes(t *testing.T) []byte {
	t.Helper()
	b, err := base64.StdEncoding.DecodeString(pngB64)
	if err != nil {
		t.Fatalf("decode fixture png: %v", err)
	}
	return b
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(b)
}
