package vtesting

import (
	"testing"

	"github.com/go-git/go-git/v6/plumbing"
)

func TestFunc_ReferenceRoundTrip(t *testing.T) {
	_, r := newBareRepo(t)
	names := []plumbing.ReferenceName{
		"refs/heads/main",
		"refs/heads/feature/deep/name",
		"refs/tags/v1.0.0",
		"refs/remotes/origin/main",
		"refs/notes/commits",
	}
	for _, name := range names {
		if err := r.Storer.SetReference(plumbing.NewHashReference(name, testHash())); err != nil {
			t.Fatalf("storing %q: %v", name, err)
		}
		ref, err := r.Storer.Reference(name)
		if err != nil {
			t.Fatalf("reading %q: %v", name, err)
		}
		if ref.Name() != name || ref.Hash() != testHash() {
			t.Fatalf("round trip for %q returned %q %s", name, ref.Name(), ref.Hash())
		}
		if err := r.Storer.RemoveReference(name); err != nil {
			t.Fatalf("removing %q: %v", name, err)
		}
		if _, err := r.Storer.Reference(name); err == nil {
			t.Fatalf("%q still resolves after removal", name)
		}
	}
}

func TestFunc_RootReferences(t *testing.T) {
	_, r := newBareRepo(t)
	if err := r.Storer.SetReference(newHashReference("refs/heads/main")); err != nil {
		t.Fatalf("creating a branch: %v", err)
	}
	if err := r.Storer.SetReference(plumbing.NewSymbolicReference("HEAD", "refs/heads/main")); err != nil {
		t.Fatalf("pointing HEAD at a branch: %v", err)
	}
	ref, err := r.Storer.Reference("HEAD")
	if err != nil {
		t.Fatalf("reading HEAD: %v", err)
	}
	if ref.Target() != "refs/heads/main" {
		t.Fatalf("HEAD targets %q", ref.Target())
	}
	head, err := r.Head()
	if err != nil {
		t.Fatalf("resolving HEAD: %v", err)
	}
	if head.Name() != "refs/heads/main" {
		t.Fatalf("resolved HEAD is %q", head.Name())
	}

	for _, name := range []plumbing.ReferenceName{"ORIG_HEAD", "FETCH_HEAD", "MERGE_HEAD", "bar"} {
		if err := r.Storer.SetReference(plumbing.NewHashReference(name, testHash())); err != nil {
			t.Fatalf("storing %q: %v", name, err)
		}
		if _, err := r.Storer.Reference(name); err != nil {
			t.Fatalf("reading %q: %v", name, err)
		}
	}
}

func TestFunc_InvalidPlaceholderReference(t *testing.T) {
	_, r := newBareRepo(t)
	invalid := plumbing.ReferenceName("refs/heads/.invalid")
	if err := r.Storer.SetReference(plumbing.NewHashReference(invalid, testHash())); err != nil {
		t.Fatalf("storing the placeholder reference: %v", err)
	}
	if _, err := r.Storer.Reference(invalid); err != nil {
		t.Fatalf("reading the placeholder reference: %v", err)
	}
	if err := r.Storer.SetReference(plumbing.NewSymbolicReference("HEAD", invalid)); err != nil {
		t.Fatalf("pointing HEAD at the placeholder reference: %v", err)
	}
	ref, err := r.Storer.Reference("HEAD")
	if err != nil {
		t.Fatalf("reading HEAD: %v", err)
	}
	if ref.Target() != invalid {
		t.Fatalf("HEAD targets %q", ref.Target())
	}
}
