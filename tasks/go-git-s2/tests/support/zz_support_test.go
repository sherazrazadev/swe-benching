package vtesting

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/go-git/go-billy/v6"
	"github.com/go-git/go-billy/v6/osfs"
	git "github.com/go-git/go-git/v6"
	"github.com/go-git/go-git/v6/plumbing"
	"github.com/go-git/go-git/v6/plumbing/cache"
	"github.com/go-git/go-git/v6/plumbing/format/reflog"
	"github.com/go-git/go-git/v6/plumbing/storer"
	"github.com/go-git/go-git/v6/storage/filesystem"
)

const testHashHex = "e8d3ffab552895c19b9fcf7aa264d277cde33881"

func testHash() plumbing.Hash { return plumbing.NewHash(testHashHex) }

func newHashReference(name string) *plumbing.Reference {
	return plumbing.NewHashReference(plumbingName(name), testHash())
}

func plumbingName(s string) plumbing.ReferenceName { return plumbing.ReferenceName(s) }

// newBareRepo returns a bare repository whose git directory is dir.
func newBareRepo(t *testing.T) (string, *git.Repository) {
	t.Helper()
	dir := t.TempDir()
	r, err := git.PlainInit(dir, true)
	if err != nil {
		t.Fatalf("initialising a repository: %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })
	return dir, r
}

// noReadWriteFS advertises a filesystem that cannot open files read-write, so
// the storage takes its second write implementation.
type noReadWriteFS struct{ billy.Filesystem }

func (f noReadWriteFS) Capabilities() billy.Capability {
	return billy.Capabilities(f.Filesystem) &^ billy.ReadAndWriteCapability
}

func newRepoOnNoReadWriteFS(t *testing.T) (string, *git.Repository) {
	t.Helper()
	dir := t.TempDir()
	st := filesystem.NewStorage(noReadWriteFS{osfs.New(dir)}, cache.NewObjectLRUDefault())
	r, err := git.Init(st)
	if err != nil {
		t.Fatalf("initialising a repository on a filesystem without read-write support: %v", err)
	}
	t.Cleanup(func() { _ = r.Close() })
	return dir, r
}

// storageOf returns the filesystem storage behind the repository, which
// exposes the reference maintenance operations.
func storageOf(t *testing.T, r *git.Repository) *filesystem.Storage {
	t.Helper()
	st, ok := r.Storer.(*filesystem.Storage)
	if !ok {
		t.Fatalf("the repository does not use filesystem storage")
	}
	return st
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("creating parent directory for %s: %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("writing %s: %v", path, err)
	}
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading %s: %v", path, err)
	}
	return string(b)
}

func requireUnchanged(t *testing.T, path, want string) {
	t.Helper()
	if got := readFile(t, path); got != want {
		t.Fatalf("%s changed by an operation that must have no effect: got %q, want %q", path, got, want)
	}
}

// requireRefused asserts that a name was refused. It does not require a
// particular error value: any error is a refusal.
func requireRefused(t *testing.T, err error) {
	t.Helper()
	if err == nil {
		t.Fatalf("an unsafe reference name was accepted; want a refusal")
	}
}

func reflogStorer(t *testing.T, r *git.Repository) storer.ReflogStorer {
	t.Helper()
	rs, ok := r.Storer.(storer.ReflogStorer)
	if !ok {
		t.Fatalf("the storage does not expose reflog operations")
	}
	return rs
}

func testReflogEntry() *reflog.Entry {
	return &reflog.Entry{
		OldHash:   plumbing.ZeroHash,
		NewHash:   testHash(),
		Committer: reflog.Signature{Name: "A U Thor", Email: "author@example.com", When: newTime},
		Message:   "commit: initial",
	}
}

const validReflogLine = "0000000000000000000000000000000000000000 " +
	testHashHex + " A U Thor <author@example.com> 1700000000 +0000\tcommit: initial\n"

// reflogLineAt builds a reflog line with the given committer time.
func reflogLineAt(ts int64) string {
	return "0000000000000000000000000000000000000000 " +
		testHashHex + " A U Thor <author@example.com> " + strconv.FormatInt(ts, 10) + " +0000\tcommit: initial\n"
}

// oldTime and newTime bracket reflog entries used by the expiry test.
var (
	oldTime = time.Unix(1700000000, 0)
	newTime = time.Unix(1900000000, 0)
)
