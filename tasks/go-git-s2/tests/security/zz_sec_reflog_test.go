package vtesting

import (
	"path/filepath"
	"testing"
)

// Appending a reflog entry must not write into repository metadata.
func TestSec_ReflogAppendDoesNotWriteMetadata(t *testing.T) {
	dir, r := newBareRepo(t)
	config := filepath.Join(dir, "config")
	writeFile(t, config, "repository-configuration-marker")

	err := reflogStorer(t, r).AppendReflog("refs/../../config", testReflogEntry())
	requireRefused(t, err)
	requireUnchanged(t, config, "repository-configuration-marker")
}

// Reading a reflog must not return the contents of unrelated metadata.
func TestSec_ReflogReadDoesNotReturnMetadata(t *testing.T) {
	dir, r := newBareRepo(t)
	writeFile(t, filepath.Join(dir, "hooks", "post-checkout"), validReflogLine)

	entries, err := reflogStorer(t, r).Reflog("../hooks/post-checkout")
	requireRefused(t, err)
	if len(entries) != 0 {
		t.Fatalf("a metadata file was returned as a reflog with %d entries", len(entries))
	}
}

// Deleting a reflog must not remove unrelated metadata.
func TestSec_ReflogDeleteDoesNotRemoveMetadata(t *testing.T) {
	dir, r := newBareRepo(t)
	hook := filepath.Join(dir, "hooks", "post-checkout")
	writeFile(t, hook, "hook-marker")

	err := reflogStorer(t, r).DeleteReflog("../hooks/post-checkout")
	requireRefused(t, err)
	requireUnchanged(t, hook, "hook-marker")
}

// Expiring a reflog must not rewrite unrelated metadata in place.
func TestSec_ReflogExpireDoesNotRewriteMetadata(t *testing.T) {
	for _, name := range []string{"../config", "refs/../../config"} {
		t.Run(name, func(t *testing.T) {
			dir, r := newBareRepo(t)
			config := filepath.Join(dir, "config")
			writeFile(t, config, reflogLineAt(oldTime.Unix()))

			err := storageOf(t, r).ExpireReflog(plumbingName(name), newTime)
			requireRefused(t, err)
			requireUnchanged(t, config, reflogLineAt(oldTime.Unix()))
		})
	}
}
