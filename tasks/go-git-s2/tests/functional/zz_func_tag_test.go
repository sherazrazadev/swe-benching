package vtesting

import (
	"testing"

	"github.com/go-git/go-git/v6/plumbing"
)

func TestFunc_TagAPI(t *testing.T) {
	_, r := newBareRepo(t)
	for _, name := range []string{"v1", "release/v2"} {
		ref, err := r.CreateTag(name, testHash(), nil)
		if err != nil {
			t.Fatalf("creating tag %q: %v", name, err)
		}
		if ref.Name().Short() != name {
			t.Fatalf("created tag %q reports %q", name, ref.Name().Short())
		}
		got, err := r.Tag(name)
		if err != nil {
			t.Fatalf("reading tag %q: %v", name, err)
		}
		if got.Hash() != testHash() {
			t.Fatalf("tag %q resolves to %s", name, got.Hash())
		}
	}
	for _, name := range []string{"v1", "release/v2"} {
		if err := r.DeleteTag(name); err != nil {
			t.Fatalf("deleting tag %q: %v", name, err)
		}
		if _, err := r.Tag(name); err == nil {
			t.Fatalf("tag %q still resolves after deletion", name)
		}
	}
}

func TestFunc_PackRefsKeepsReferences(t *testing.T) {
	_, r := newBareRepo(t)
	for _, name := range []string{"refs/heads/main", "refs/heads/topic", "refs/tags/v1"} {
		if err := r.Storer.SetReference(newHashReference(name)); err != nil {
			t.Fatalf("storing %q: %v", name, err)
		}
	}
	packer, ok := r.Storer.(interface{ PackRefs() error })
	if !ok {
		t.Fatalf("the storage does not expose ref packing")
	}
	if err := packer.PackRefs(); err != nil {
		t.Fatalf("packing references: %v", err)
	}
	for _, name := range []string{"refs/heads/main", "refs/heads/topic", "refs/tags/v1"} {
		ref, err := r.Storer.Reference(plumbing.ReferenceName(name))
		if err != nil {
			t.Fatalf("reading %q after packing: %v", name, err)
		}
		if ref.Hash() != testHash() {
			t.Fatalf("%q resolves to %s after packing", name, ref.Hash())
		}
	}
}
