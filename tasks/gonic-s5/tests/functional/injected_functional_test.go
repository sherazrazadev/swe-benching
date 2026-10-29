package vtesting

import (
	"bytes"
	"encoding/base64"
	"net/url"
	"strings"
	"testing"
)

// An owner may upload a cover for their own playlist, including a nested, dotted one,
// and have it served back.
func TestFuncOwnerUploadsPlaylistCover(t *testing.T) {
	h := newHarness(t)
	rel := h.adminDir() + "/sub.dir/my.list.m3u"
	h.writePlaylist(rel, "my list", "", false)
	img := pngBytes(t)

	_, env := h.do(h.admin, "setPlaylistCover", url.Values{
		"id":   {encodeID(rel)},
		"data": {base64.StdEncoding.EncodeToString(img)},
	})
	if env.Response.Status != "ok" {
		t.Fatalf("the owner could not upload a playlist cover (status=%q)", env.Response.Status)
	}

	rec, env := h.do(h.admin, "getCoverArt", url.Values{"id": {encodeID(rel)}})
	if refused(env) {
		t.Fatalf("the uploaded cover of a nested playlist was refused")
	}
	if !strings.HasPrefix(rec.Header().Get("Content-Type"), "image/") {
		t.Fatalf("the uploaded cover was not served: content-type %q", rec.Header().Get("Content-Type"))
	}
	if !bytes.HasPrefix(rec.Body.Bytes(), []byte("\x89PNG\r\n\x1a\n")) {
		t.Fatalf("the served cover is not the uploaded image (%d bytes)", rec.Body.Len())
	}
}

// An owner may duplicate their own playlist, including a nested one with dotted names,
// and read the copy back.
func TestFuncOwnerDuplicatesPlaylist(t *testing.T) {
	h := newHarness(t)
	rel := h.adminDir() + "/sub.dir/source.list.m3u"
	h.writePlaylist(rel, "source list", "a comment", false)

	_, env := h.do(h.admin, "duplicatePlaylist", url.Values{
		"id":   {encodeID(rel)},
		"name": {"copy.list.v2"},
	})
	if env.Response.Status != "ok" || env.Response.Playlist == nil {
		t.Fatalf("the owner could not duplicate a playlist (status=%q)", env.Response.Status)
	}
	newRel := decodeID(env.Response.Playlist.ID)
	if !strings.HasPrefix(newRel, h.adminDir()+"/sub.dir/") ||
		!strings.HasSuffix(newRel, "copy.list.v2.m3u") {
		t.Fatalf("the duplicate was not placed beside the original under the caller's area: %q", newRel)
	}

	_, env = h.do(h.admin, "getPlaylist", url.Values{"id": {encodeID(newRel)}})
	if env.Response.Status != "ok" || env.Response.Playlist == nil ||
		env.Response.Playlist.Name != "copy.list.v2" {
		t.Fatalf("the owner could not read the duplicate back: %+v", env.Response.Playlist)
	}
}
