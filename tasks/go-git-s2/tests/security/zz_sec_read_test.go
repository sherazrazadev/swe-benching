package vtesting

import (
	"path/filepath"
	"testing"
)

// Reading a reference must not return unrelated repository metadata.
func TestSec_ReadDoesNotReturnMetadata(t *testing.T) {
	dir, r := newBareRepo(t)
	writeFile(t, filepath.Join(dir, "hooks", "post-checkout"), testHashHex+"\n")

	ref, err := r.Storer.Reference("hooks/post-checkout")
	requireRefused(t, err)
	if ref != nil {
		t.Fatalf("a metadata file was returned as reference %q", ref.Name())
	}
}

// A parent-path component must not let a read reach data next to the
// reference tree.
func TestSec_ReadRejectsTraversalName(t *testing.T) {
	dir, r := newBareRepo(t)
	writeFile(t, filepath.Join(dir, "config"), "repository-configuration-marker")

	ref, err := r.Storer.Reference("refs/../../config")
	requireRefused(t, err)
	if ref != nil {
		t.Fatalf("a traversal name was returned as reference %q", ref.Name())
	}
}
