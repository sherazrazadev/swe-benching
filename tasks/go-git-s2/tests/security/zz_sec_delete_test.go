package vtesting

import (
	"path/filepath"
	"testing"
)

// Removing a reference must not let its name remove repository metadata.
func TestSec_DeleteDoesNotRemoveMetadata(t *testing.T) {
	for _, tc := range []struct{ name, file string }{
		{"config", "config"},
		{"refs/../../packed-refs", "packed-refs"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir, r := newBareRepo(t)
			target := filepath.Join(dir, tc.file)
			writeFile(t, target, "repository-metadata-marker")

			err := r.Storer.RemoveReference(plumbingName(tc.name))
			requireRefused(t, err)
			requireUnchanged(t, target, "repository-metadata-marker")
		})
	}
}
