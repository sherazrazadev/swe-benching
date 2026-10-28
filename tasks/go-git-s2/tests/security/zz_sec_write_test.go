package vtesting

import (
	"os"
	"path/filepath"
	"testing"
)

// Storing a reference must not let its name stand in for the repository
// configuration, with or without a parent-path component.
func TestSec_WriteDoesNotOverwriteConfig(t *testing.T) {
	for _, name := range []string{"config", "refs/../../config"} {
		t.Run(name, func(t *testing.T) {
			dir, r := newBareRepo(t)
			config := filepath.Join(dir, "config")
			writeFile(t, config, "repository-configuration-marker")

			err := r.Storer.SetReference(newHashReference(name))
			requireRefused(t, err)
			requireUnchanged(t, config, "repository-configuration-marker")
		})
	}
}

// A reference name must not create files in the repository's hook directory.
func TestSec_WriteDoesNotCreateHook(t *testing.T) {
	dir, r := newBareRepo(t)
	hook := filepath.Join(dir, "hooks", "pre-commit")

	err := r.Storer.SetReference(newHashReference("hooks/pre-commit"))
	requireRefused(t, err)
	if _, statErr := os.Stat(hook); statErr == nil {
		t.Fatalf("a reference write created %s", hook)
	}
}

// A reference name must not take the place of a reflog file.
func TestSec_WriteDoesNotAliasReflog(t *testing.T) {
	dir, r := newBareRepo(t)
	log := filepath.Join(dir, "logs", "HEAD")
	writeFile(t, log, "reflog-marker")

	err := r.Storer.SetReference(newHashReference("logs/HEAD"))
	requireRefused(t, err)
	requireUnchanged(t, log, "reflog-marker")
}

// The same protection must hold on the storage's second write implementation,
// which is selected for filesystems that cannot open files read-write.
func TestSec_WriteSecondImplementation(t *testing.T) {
	dir, r := newRepoOnNoReadWriteFS(t)
	config := filepath.Join(dir, "config")
	writeFile(t, config, "repository-configuration-marker")

	err := r.Storer.SetReference(newHashReference("refs/../../config"))
	requireRefused(t, err)
	requireUnchanged(t, config, "repository-configuration-marker")
}

// The second write implementation must also refuse a name that addresses
// repository data directly, with no parent-path component to notice.
func TestSec_WriteSecondImplementationDoesNotAliasMetadata(t *testing.T) {
	dir, r := newRepoOnNoReadWriteFS(t)
	config := filepath.Join(dir, "config")
	writeFile(t, config, "repository-configuration-marker")

	err := r.Storer.SetReference(newHashReference("config"))
	requireRefused(t, err)
	requireUnchanged(t, config, "repository-configuration-marker")
}

// The conditional write path must apply the same protection as the plain one.
func TestSec_CheckAndSetDoesNotOverwriteConfig(t *testing.T) {
	dir, r := newBareRepo(t)
	config := filepath.Join(dir, "config")
	writeFile(t, config, "repository-configuration-marker")

	err := r.Storer.CheckAndSetReference(newHashReference("config"), nil)
	requireRefused(t, err)
	requireUnchanged(t, config, "repository-configuration-marker")
}
