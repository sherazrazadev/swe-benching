package vtesting

import (
	"os"
	"path/filepath"
	"testing"
)

// Renaming a reference must not move repository metadata into the reference
// tree.
func TestSec_RenameDoesNotMoveMetadata(t *testing.T) {
	dir, r := newBareRepo(t)
	config := filepath.Join(dir, "config")
	writeFile(t, config, "repository-configuration-marker")

	err := storageOf(t, r).RenameReference("config", plumbingName("refs/heads/leak"))
	requireRefused(t, err)
	requireUnchanged(t, config, "repository-configuration-marker")
}

// A source name that climbs to repository metadata must not move it into the
// reference tree either.
func TestSec_RenameDoesNotMoveTraversalMetadata(t *testing.T) {
	dir, r := newBareRepo(t)
	config := filepath.Join(dir, "config")
	writeFile(t, config, "repository-configuration-marker")

	err := storageOf(t, r).RenameReference("refs/../../config", plumbingName("refs/heads/leak"))
	requireRefused(t, err)
	requireUnchanged(t, config, "repository-configuration-marker")
	if _, statErr := os.Stat(filepath.Join(dir, "refs", "heads", "leak")); statErr == nil {
		t.Fatalf("metadata was moved into the reference tree")
	}
}

// Renaming a reference must not overwrite repository metadata.
func TestSec_RenameDoesNotOverwriteMetadata(t *testing.T) {
	for _, name := range []string{"config", "refs/../../config"} {
		t.Run(name, func(t *testing.T) {
			dir, r := newBareRepo(t)
			if err := r.Storer.SetReference(newHashReference("refs/heads/main")); err != nil {
				t.Fatalf("creating a branch: %v", err)
			}
			config := filepath.Join(dir, "config")
			writeFile(t, config, "repository-configuration-marker")

			err := storageOf(t, r).RenameReference("refs/heads/main", plumbingName(name))
			requireRefused(t, err)
			requireUnchanged(t, config, "repository-configuration-marker")
			if _, refErr := r.Storer.Reference("refs/heads/main"); refErr != nil {
				t.Fatalf("the source reference was moved by a refused rename: %v", refErr)
			}
		})
	}
}
