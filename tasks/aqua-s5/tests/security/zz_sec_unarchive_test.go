package unarchive_test

import (
	"archive/tar"
	"os"
	"path/filepath"
	"testing"
)

// Each case extracts a package that tries to reach a path outside the install
// directory, and requires a clean refusal with no outside effect left behind.

func TestSec_EntryDotDot(t *testing.T) {
	_, dest, outside := fixtureWithOutside(t)
	data := buildTarGz(t, []archiveEntry{{name: "../outside/target", body: []byte(overwrite)}})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err == nil {
		t.Fatal("extraction of a package entry escaping the install directory must be refused")
	}
	requireSentinelIntact(t, outside)
}

func TestSec_EntryBackslash(t *testing.T) {
	_, dest, outside := fixtureWithOutside(t)
	data := buildTarGz(t, []archiveEntry{{name: `..\outside\target`, body: []byte(overwrite)}})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err == nil {
		t.Fatal("extraction of a package entry escaping the install directory must be refused")
	}
	requireSentinelIntact(t, outside)
}

func TestSec_EntrySiblingPrefix(t *testing.T) {
	parent, dest, _ := fixtureDirs(t)
	sibling := filepath.Join(parent, "dest-sibling", "evil")
	data := buildTarGz(t, []archiveEntry{{name: "../dest-sibling/evil", body: []byte(overwrite)}})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err == nil {
		t.Fatal("extraction of a package entry escaping the install directory must be refused")
	}
	if b, err := os.ReadFile(sibling); err == nil {
		t.Fatalf("a file was written outside the install directory: %q", b)
	}
}

func TestSec_EntryCreatesNoOutsideDirectory(t *testing.T) {
	parent, dest, _ := fixtureDirs(t)
	outsideDir := filepath.Join(parent, "newdir")
	data := buildTarGz(t, []archiveEntry{{name: "../newdir/evil", body: []byte(overwrite)}})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err == nil {
		t.Fatal("extraction of a package entry escaping the install directory must be refused")
	}
	if _, err := os.Stat(outsideDir); err == nil {
		t.Fatal("a directory outside the install directory was created")
	}
}

func TestSec_SymlinkAbsoluteTarget(t *testing.T) {
	_, dest, outside := fixtureWithOutside(t)
	data := buildTarGz(t, []archiveEntry{
		{name: "sub/link", typ: tar.TypeSymlink, link: outside},
		{name: "sub/link", body: []byte(overwrite)},
	})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err == nil {
		t.Fatal("extraction of a package with a link leaving the install directory must be refused")
	}
	requireSentinelIntact(t, outside)
}

func TestSec_SymlinkRelativeTarget(t *testing.T) {
	_, dest, outside := fixtureWithOutside(t)
	data := buildTarGz(t, []archiveEntry{
		{name: "sub/link", typ: tar.TypeSymlink, link: "../../outside/target"},
		{name: "sub/link", body: []byte(overwrite)},
	})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err == nil {
		t.Fatal("extraction of a package with a link leaving the install directory must be refused")
	}
	requireSentinelIntact(t, outside)
}

func TestSec_HardlinkNestedTarget(t *testing.T) {
	_, dest, outside := fixtureWithOutside(t)
	data := buildTarGz(t, []archiveEntry{
		{name: "sub/h", typ: tar.TypeLink, link: "../outside/target"},
		{name: "sub/h", body: []byte(overwrite)},
	})
	if err := extractAsset(t, "asset.tar.gz", data, dest); err == nil {
		t.Fatal("extraction of a package with a link leaving the install directory must be refused")
	}
	requireSentinelIntact(t, outside)
}

func TestSec_ZipEntryDotDot(t *testing.T) {
	_, dest, outside := fixtureWithOutside(t)
	data := buildZip(t, []zipEntry{{name: "../outside/target", body: []byte(overwrite)}})
	if err := extractAsset(t, "asset.zip", data, dest); err == nil {
		t.Fatal("extraction of a package entry escaping the install directory must be refused")
	}
	requireSentinelIntact(t, outside)
}

func TestSec_ZipSymlinkRelativeTarget(t *testing.T) {
	_, dest, outside := fixtureWithOutside(t)
	data := buildZip(t, []zipEntry{
		{name: "sub/link", mode: os.ModeSymlink | 0o777, body: []byte("../../outside/target")},
		{name: "sub/link", body: []byte(overwrite)},
	})
	if err := extractAsset(t, "asset.zip", data, dest); err == nil {
		t.Fatal("extraction of a package with a link leaving the install directory must be refused")
	}
	requireSentinelIntact(t, outside)
}
