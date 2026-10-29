package vtesting

import (
	"encoding/base64"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// tree returns the relative paths of everything under root, so a test can prove a
// request changed nothing outside the playlist storage area.
func tree(t *testing.T, root string) []string {
	t.Helper()
	var out []string
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		out = append(out, rel)
		return nil
	})
	if err != nil {
		t.Fatalf("walk %s: %v", root, err)
	}
	sort.Strings(out)
	return out
}

func sameTree(t *testing.T, before, after []string) bool {
	t.Helper()
	return strings.Join(before, "\x00") == strings.Join(after, "\x00")
}

// A client supplied image must not be written outside the playlist storage area.
func TestSecUploadCoverOutsideStorageRefused(t *testing.T) {
	h := newHarness(t)
	outside := filepath.Join(h.root, "outside")
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outside, "secret.m3u"),
		[]byte(attrName+`"outside"`+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	before := tree(t, outside)

	_, _ = h.do(h.admin, "setPlaylistCover", url.Values{
		"id":   {encodeID("../outside/secret.m3u")},
		"data": {base64.StdEncoding.EncodeToString(pngBytes(t))},
	})

	if after := tree(t, outside); !sameTree(t, before, after) {
		t.Fatalf("a playlist cover upload changed files outside the playlists storage: %q", after)
	}
}

// A name a client gives a playlist must not turn into a location outside the
// playlist storage area.
func TestSecDuplicateNameOutsideStorageRefused(t *testing.T) {
	h := newHarness(t)
	outside := filepath.Join(h.root, "outside")
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outside, "sentinel.txt"), []byte("keep me"), 0o600); err != nil {
		t.Fatal(err)
	}
	before := tree(t, outside)

	h.writePlaylist(h.adminDir()+"/mine.m3u", "mine", "", false)
	_, _ = h.do(h.admin, "duplicatePlaylist", url.Values{
		"id":   {encodeID(h.adminDir() + "/mine.m3u")},
		"name": {"../../outside/planted"},
	})

	if after := tree(t, outside); !sameTree(t, before, after) {
		t.Fatalf("a playlist duplicate changed files outside the playlists storage: %q", after)
	}
}

// The identifier of the playlist being duplicated must not read outside the area.
func TestSecDuplicateSourceOutsideStorageRefused(t *testing.T) {
	h := newHarness(t)
	outside := filepath.Join(h.root, "outside")
	if err := os.MkdirAll(outside, 0o755); err != nil {
		t.Fatal(err)
	}
	marker := "outside-content-marker"
	if err := os.WriteFile(filepath.Join(outside, "secret.m3u"),
		[]byte(attrName+`"`+marker+`"`+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	h.writePlaylist(h.adminDir()+"/mine.m3u", "mine", "", false)

	rec, env := h.do(h.admin, "duplicatePlaylist", url.Values{
		"id":   {encodeID(h.adminDir() + "/../../outside/secret.m3u")},
		"name": {"copy"},
	})
	if !refused(env) || strings.Contains(rec.Body.String(), marker) {
		t.Fatalf("a playlist duplicate read a playlist outside the playlists storage (status=%q)",
			env.Response.Status)
	}
}
