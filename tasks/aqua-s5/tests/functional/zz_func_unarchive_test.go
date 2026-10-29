package unarchive_test

import (
	"archive/tar"
	"os"
	"path/filepath"
	"testing"
)

// These cases are ordinary package shapes that must keep installing exactly as they
// do today: nested trees, dot-prefixed and backslash-separated names, links whose
// targets are inside the install directory (including relative and not-yet-created
// ones), and hard links between files in the same package.

func TestFunc_NestedTreeAndDotNames(t *testing.T) {
	_, dest, _ := fixtureDirs(t)
	data := buildTarGz(t, []archiveEntry{
		{name: "bin/", typ: tar.TypeDir},
		{name: "./bin/tool", body: []byte("tool")},
		{name: "share/doc/README", body: []byte("readme")},
		{name: "foo..tar.gz", body: []byte("dots")},
		{name: "a..b/c.txt", body: []byte("dots2")},
	})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err != nil {
		t.Fatal(err)
	}
	for path, want := range map[string]string{
		"bin/tool":         "tool",
		"share/doc/README": "readme",
		"foo..tar.gz":      "dots",
		"a..b/c.txt":       "dots2",
	} {
		b, err := os.ReadFile(filepath.Join(dest, path))
		if err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		if string(b) != want {
			t.Fatalf("%s = %q, want %q", path, b, want)
		}
	}
}

func TestFunc_BackslashSeparatedNames(t *testing.T) {
	_, dest, _ := fixtureDirs(t)
	data := buildTarGz(t, []archiveEntry{
		{name: `bin\`, typ: tar.TypeDir},
		{name: `bin\tool.exe`, body: []byte("win")},
	})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(dest, "bin", "tool.exe"))
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "win" {
		t.Fatalf("got %q", b)
	}
}

func TestFunc_RelativeDanglingSymlink(t *testing.T) {
	_, dest, _ := fixtureDirs(t)
	data := buildTarGz(t, []archiveEntry{
		{name: "lib/libfoo.so.1", typ: tar.TypeSymlink, link: "libfoo.so.1.2.3"},
		{name: "lib/libfoo.so.1.2.3", body: []byte("lib")},
	})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(dest, "lib", "libfoo.so.1")
	target, err := os.Readlink(link)
	if err != nil {
		t.Fatalf("the relative symlink was not created: %v", err)
	}
	if target != "libfoo.so.1.2.3" {
		t.Fatalf("symlink target = %q", target)
	}
	b, err := os.ReadFile(link)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "lib" {
		t.Fatalf("through the symlink: %q", b)
	}
}

func TestFunc_AbsoluteSymlinkInsideDest(t *testing.T) {
	_, dest, _ := fixtureDirs(t)
	real := filepath.Join(dest, "real")
	data := buildTarGz(t, []archiveEntry{
		{name: "real", body: []byte("real")},
		{name: "link", typ: tar.TypeSymlink, link: real},
	})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(dest, "link"))
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "real" {
		t.Fatalf("got %q", b)
	}
}

func TestFunc_HardlinkInsideDest(t *testing.T) {
	_, dest, _ := fixtureDirs(t)
	data := buildTarGz(t, []archiveEntry{
		{name: "bin/tool", body: []byte("tool")},
		{name: "bin/tool-alias", typ: tar.TypeLink, link: "bin/tool"},
	})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err != nil {
		t.Fatal(err)
	}
	a, err := os.Stat(filepath.Join(dest, "bin", "tool"))
	if err != nil {
		t.Fatal(err)
	}
	b, err := os.Stat(filepath.Join(dest, "bin", "tool-alias"))
	if err != nil {
		t.Fatalf("the hard link inside the package was not created: %v", err)
	}
	if !os.SameFile(a, b) {
		t.Fatal("the hard link inside the package was not created")
	}
	body, err := os.ReadFile(filepath.Join(dest, "bin", "tool-alias"))
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "tool" {
		t.Fatalf("got %q", body)
	}
}

func TestFunc_ZipTreeAndSymlink(t *testing.T) {
	_, dest, _ := fixtureDirs(t)
	data := buildZip(t, []zipEntry{
		{name: "bin/", mode: os.ModeDir | 0o755},
		{name: "bin/tool", body: []byte("ziptool"), mode: 0o755},
		{name: "lib/libfoo.so.1.2.3", body: []byte("ziplib")},
		{name: "lib/libfoo.so.1", mode: os.ModeSymlink | 0o777, body: []byte("libfoo.so.1.2.3")},
	})
	if err := extractAsset(t, "asset.zip", data, dest); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(dest, "bin", "tool"))
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "ziptool" {
		t.Fatalf("got %q", b)
	}
	link := filepath.Join(dest, "lib", "libfoo.so.1")
	target, err := os.Readlink(link)
	if err != nil {
		t.Fatalf("the symlink inside the package was not created: %v", err)
	}
	if target != "libfoo.so.1.2.3" {
		t.Fatalf("symlink target = %q", target)
	}
	body, err := os.ReadFile(link)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "ziplib" {
		t.Fatalf("through the symlink: %q", body)
	}
}
