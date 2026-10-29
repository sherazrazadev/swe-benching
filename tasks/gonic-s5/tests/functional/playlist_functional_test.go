package vtesting

import (
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// These cases exercise ordinary, legitimate playlist use. They must pass on the
// unmodified product and on every correct fix.

func TestFuncOwnerReadsOwnPlaylist(t *testing.T) {
	h := newHarness(t)
	rel := h.adminDir() + "/mine.m3u"
	h.writePlaylist(rel, "my private list", "a comment", false)

	_, env := h.do(h.admin, "getPlaylist", url.Values{"id": {encodeID(rel)}})
	if env.Response.Status != "ok" || env.Response.Playlist == nil {
		t.Fatalf("the owner could not read their own playlist (status=%q)", env.Response.Status)
	}
	got := env.Response.Playlist
	if got.Name != "my private list" || got.Comment != "a comment" || got.Owner != h.admin.Name {
		t.Fatalf("the owner's playlist came back wrong: %+v", got)
	}
}

func TestFuncOtherListenerReadsPublicPlaylist(t *testing.T) {
	h := newHarness(t)
	rel := h.adminDir() + "/shared.m3u"
	h.writePlaylist(rel, "shared list", "", true)

	_, env := h.do(h.alt, "getPlaylist", url.Values{"id": {encodeID(rel)}})
	if env.Response.Status != "ok" || env.Response.Playlist == nil {
		t.Fatalf("a shared playlist was not readable by another listener (status=%q)", env.Response.Status)
	}
	if env.Response.Playlist.Name != "shared list" {
		t.Fatalf("shared playlist came back as %q", env.Response.Playlist.Name)
	}
}

func TestFuncOwnerUpdatesAndDeletesOwnPlaylist(t *testing.T) {
	h := newHarness(t)
	rel := h.adminDir() + "/mine.m3u"
	path := h.writePlaylist(rel, "before", "old comment", false)

	_, env := h.do(h.admin, "updatePlaylist", url.Values{
		"id":      {encodeID(rel)},
		"name":    {"after"},
		"comment": {"new comment"},
	})
	if env.Response.Status != "ok" {
		t.Fatalf("the owner could not update their own playlist (status=%q)", env.Response.Status)
	}
	_, env = h.do(h.admin, "getPlaylist", url.Values{"id": {encodeID(rel)}})
	if env.Response.Playlist == nil || env.Response.Playlist.Name != "after" ||
		env.Response.Playlist.Comment != "new comment" {
		t.Fatalf("the owner's update was not applied: %+v", env.Response.Playlist)
	}

	_, _ = h.do(h.admin, "deletePlaylist", url.Values{"id": {encodeID(rel)}})
	if _, err := os.Stat(path); err == nil {
		t.Fatalf("the owner's delete did not remove the playlist file")
	}
}

func TestFuncCreateWithoutIDCreatesCallersPlaylist(t *testing.T) {
	h := newHarness(t)
	_, env := h.do(h.alt, "createPlaylist", url.Values{"name": {"fresh list"}})
	if env.Response.Status != "ok" || env.Response.Playlist == nil {
		t.Fatalf("creating a playlist without an id failed (status=%q)", env.Response.Status)
	}
	created := env.Response.Playlist
	if created.ID == "" {
		t.Fatal("creating a playlist returned no identifier")
	}
	rel := decodeID(created.ID)
	if !strings.HasPrefix(rel, h.altDir()+"/") {
		t.Fatalf("a new playlist was not laid out under the caller's own area: %q", rel)
	}

	_, env = h.do(h.alt, "getPlaylist", url.Values{"id": {created.ID}})
	if env.Response.Status != "ok" || env.Response.Playlist == nil || env.Response.Playlist.Name != "fresh list" {
		t.Fatalf("the caller could not read back the playlist they created")
	}
}

func TestFuncNestedDottedPathReadableAndCoverServed(t *testing.T) {
	h := newHarness(t)
	rel := h.adminDir() + "/sub.dir/my.list.v2.m3u"
	h.writePlaylist(rel, "nested dotted list", "", false)
	coverAbs := filepath.Join(h.base, h.adminDir(), "sub.dir", "my.list.v2.png")
	if err := os.WriteFile(coverAbs, pngBytes(t), 0o600); err != nil {
		t.Fatal(err)
	}

	_, env := h.do(h.admin, "getPlaylist", url.Values{"id": {encodeID(rel)}})
	if env.Response.Status != "ok" || env.Response.Playlist == nil ||
		env.Response.Playlist.Name != "nested dotted list" {
		t.Fatalf("a nested, dotted playlist path no longer resolves (status=%q)", env.Response.Status)
	}

	rec, env := h.do(h.admin, "getCoverArt", url.Values{"id": {encodeID(rel)}})
	if refused(env) {
		t.Fatalf("the cover of a nested playlist was refused")
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "image/") {
		t.Fatalf("the cover of a nested playlist was not served: content-type %q, %d bytes", ct, rec.Body.Len())
	}
}
