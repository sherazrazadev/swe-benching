package vtesting

import (
	"testing"
)

func TestFunc_Reflogs(t *testing.T) {
	_, r := newBareRepo(t)
	if err := r.Storer.SetReference(newHashReference("refs/heads/main")); err != nil {
		t.Fatalf("creating a branch: %v", err)
	}
	rs := reflogStorer(t, r)
	for _, name := range []string{"HEAD", "refs/heads/main", "bar"} {
		refName := plumbingName(name)
		if err := rs.AppendReflog(refName, testReflogEntry()); err != nil {
			t.Fatalf("appending a reflog entry for %q: %v", refName, err)
		}
		entries, err := rs.Reflog(refName)
		if err != nil {
			t.Fatalf("reading the reflog for %q: %v", refName, err)
		}
		if len(entries) != 1 || entries[0].NewHash != testHash() {
			t.Fatalf("reflog for %q returned %d entries", refName, len(entries))
		}
		if err := rs.DeleteReflog(refName); err != nil {
			t.Fatalf("deleting the reflog for %q: %v", refName, err)
		}
		entries, err = rs.Reflog(refName)
		if err != nil {
			t.Fatalf("reading the reflog for %q after deletion: %v", refName, err)
		}
		if len(entries) != 0 {
			t.Fatalf("reflog for %q still has %d entries", refName, len(entries))
		}
	}
}
