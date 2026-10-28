package vtesting

import (
	"testing"
	"time"
)

// Legitimate references keep round-tripping through the storage's second write
// implementation.
func TestFunc_SecondWriteImplementation(t *testing.T) {
	_, r := newRepoOnNoReadWriteFS(t)
	name := plumbingName("refs/heads/main")
	if err := r.Storer.SetReference(newHashReference("refs/heads/main")); err != nil {
		t.Fatalf("storing %q on a filesystem without read-write support: %v", name, err)
	}
	ref, err := r.Storer.Reference(name)
	if err != nil {
		t.Fatalf("reading %q: %v", name, err)
	}
	if ref.Hash() != testHash() {
		t.Fatalf("%q resolves to %s", name, ref.Hash())
	}
	if err := r.Storer.RemoveReference(name); err != nil {
		t.Fatalf("removing %q: %v", name, err)
	}
}

// Renaming a reference moves it and leaves the source name free.
func TestFunc_RenameReference(t *testing.T) {
	_, r := newBareRepo(t)
	st := storageOf(t, r)
	oldName := plumbingName("refs/heads/old")
	newName := plumbingName("refs/heads/topic/new")
	if err := r.Storer.SetReference(newHashReference("refs/heads/old")); err != nil {
		t.Fatalf("creating the source reference: %v", err)
	}
	if err := st.RenameReference(oldName, newName); err != nil {
		t.Fatalf("renaming %q to %q: %v", oldName, newName, err)
	}
	if _, err := r.Storer.Reference(oldName); err == nil {
		t.Fatalf("%q still resolves after the rename", oldName)
	}
	ref, err := r.Storer.Reference(newName)
	if err != nil {
		t.Fatalf("reading %q after the rename: %v", newName, err)
	}
	if ref.Hash() != testHash() {
		t.Fatalf("%q resolves to %s", newName, ref.Hash())
	}
}

// Expiring a reflog keeps the recent entries and drops the old ones.
func TestFunc_ExpireReflog(t *testing.T) {
	_, r := newBareRepo(t)
	name := plumbingName("refs/heads/main")
	if err := r.Storer.SetReference(newHashReference("refs/heads/main")); err != nil {
		t.Fatalf("creating a branch: %v", err)
	}
	rs := reflogStorer(t, r)
	if err := rs.AppendReflog(name, testReflogEntry()); err != nil {
		t.Fatalf("appending a reflog entry: %v", err)
	}
	// The entry is newer than this cutoff, so it must be kept.
	if err := storageOf(t, r).ExpireReflog(name, oldTime); err != nil {
		t.Fatalf("expiring the reflog: %v", err)
	}
	entries, err := rs.Reflog(name)
	if err != nil {
		t.Fatalf("reading the reflog after expiry: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("the reflog kept %d entries, want 1", len(entries))
	}
	// A cutoff after the entry drops it.
	if err := storageOf(t, r).ExpireReflog(name, time.Unix(2000000000, 0)); err != nil {
		t.Fatalf("expiring the reflog: %v", err)
	}
	entries, err = rs.Reflog(name)
	if err != nil {
		t.Fatalf("reading the reflog after expiry: %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("the reflog kept %d expired entries", len(entries))
	}
	// A reference without a reflog is not an error.
	if err := storageOf(t, r).ExpireReflog(plumbingName("refs/heads/absent"), newTime); err != nil {
		t.Fatalf("expiring a missing reflog: %v", err)
	}
}
