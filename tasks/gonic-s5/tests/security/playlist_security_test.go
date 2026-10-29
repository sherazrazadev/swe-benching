package vtesting

import (
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Every case below goes through the product's own HTTP server as an authenticated
// listener. A case fails when the request reaches data or a file it must not.

func TestSecCoverArtOutsideStorageRefused(t *testing.T) {
	h := newHarness(t)
	outside := filepath.Join(h.root, "outside")
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	secret := pngBytes(t)
	if err := os.WriteFile(filepath.Join(outside, "secret.png"), secret, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outside, "secret.m3u"),
		[]byte(attrName+`"outside"`+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	rec, env := h.do(h.admin, "getCoverArt", url.Values{
		"id": {encodeID("../outside/secret.m3u")},
	})
	if !refused(env) || strings.Contains(rec.Body.String(), string(secret[:16])) {
		t.Fatalf("a cover lookup served a file outside the playlists storage (status=%q, %d bytes)",
			env.Response.Status, rec.Body.Len())
	}
}

func TestSecReadOutsideStorageRefused(t *testing.T) {
	h := newHarness(t)
	outside := filepath.Join(h.root, "outside")
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	marker := "outside-storage-marker"
	if err := os.WriteFile(filepath.Join(outside, "secret.m3u"),
		[]byte(attrName+`"`+marker+`"`+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	id := encodeID(h.adminDir() + "/../../outside/secret.m3u")
	rec, env := h.do(h.admin, "getPlaylist", url.Values{"id": {id}})
	if !refused(env) || strings.Contains(rec.Body.String(), marker) {
		t.Fatalf("a playlist read reached a file outside the playlists storage (status=%q)", env.Response.Status)
	}
}

func TestSecCreateOutsideStorageRefused(t *testing.T) {
	h := newHarness(t)
	outside := filepath.Join(h.root, "outside")
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	planted := filepath.Join(outside, "planted.m3u")

	id := encodeID(h.adminDir() + "/../../outside/planted.m3u")
	_, _ = h.do(h.admin, "createPlaylist", url.Values{"id": {id}, "name": {"planted"}})
	if _, err := os.Stat(planted); err == nil {
		t.Fatalf("a playlist write created a file outside the playlists storage")
	}
}

func TestSecDeleteOutsideStorageRefused(t *testing.T) {
	h := newHarness(t)
	outside := filepath.Join(h.root, "outside")
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	victim := filepath.Join(outside, "victim.txt")
	if err := os.WriteFile(victim, []byte("keep me"), 0o600); err != nil {
		t.Fatal(err)
	}

	id := encodeID(h.adminDir() + "/../../outside/victim.txt")
	_, _ = h.do(h.admin, "deletePlaylist", url.Values{"id": {id}})
	if _, err := os.Stat(victim); err != nil {
		t.Fatalf("a playlist delete removed a file outside the playlists storage: %v", err)
	}
}

func TestSecForeignReadRefused(t *testing.T) {
	h := newHarness(t)
	marker := "admin-private-marker"
	h.writePlaylist(h.adminDir()+"/private.m3u", marker, "secret", false)

	rec, env := h.do(h.alt, "getPlaylist", url.Values{
		"id": {encodeID(h.adminDir() + "/private.m3u")},
	})
	if !refused(env) || strings.Contains(rec.Body.String(), marker) {
		t.Fatalf("another listener read a private playlist (status=%q)", env.Response.Status)
	}
}

func TestSecForeignReplacementRefused(t *testing.T) {
	h := newHarness(t)
	path := h.writePlaylist(h.adminDir()+"/shared.m3u", "original-name", "original", true)
	before := readFile(t, path)

	_, _ = h.do(h.alt, "createPlaylist", url.Values{
		"id":   {encodeID(h.adminDir() + "/shared.m3u")},
		"name": {"taken-over"},
	})
	if after := readFile(t, path); after != before {
		t.Fatalf("another listener replaced a playlist they do not own")
	}
}

func TestSecAliasedPathCannotChangeForeignPlaylist(t *testing.T) {
	h := newHarness(t)
	path := h.writePlaylist(h.adminDir()+"/shared.m3u", "original-name", "original", true)
	before := readFile(t, path)

	alias := h.altDir() + "/../" + h.adminDir() + "/shared.m3u"
	_, _ = h.do(h.alt, "updatePlaylist", url.Values{
		"id":   {encodeID(alias)},
		"name": {"aliased-takeover"},
	})
	after := readFile(t, path)
	if after != before {
		t.Fatalf("an aliased identifier let another listener change a playlist they do not own")
	}
	_, env := h.do(h.admin, "getPlaylist", url.Values{
		"id": {encodeID(h.adminDir() + "/shared.m3u")},
	})
	if env.Response.Playlist == nil || env.Response.Playlist.Name != "original-name" {
		t.Fatalf("the owner's playlist no longer reads back unchanged")
	}
}

func TestSecForeignDeleteRefused(t *testing.T) {
	h := newHarness(t)
	path := h.writePlaylist(h.adminDir()+"/shared.m3u", "original-name", "original", true)

	_, _ = h.do(h.alt, "deletePlaylist", url.Values{
		"id": {encodeID(h.adminDir() + "/shared.m3u")},
	})
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("another listener removed a playlist they do not own: %v", err)
	}
}
