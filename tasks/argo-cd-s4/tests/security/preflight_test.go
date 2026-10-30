package security

import (
	"os"
	"testing"

	"github.com/argoproj/argo-cd/v3/util/git"
	"github.com/stretchr/testify/require"

	"argocdhidden/harness"
)

// TestSSHConnectionTestProxyCannotRunShell drives the repository connection test, which checks
// an SSH repository's proxy before the repository is contacted.
func TestSSHConnectionTestProxyCannotRunShell(t *testing.T) {
	for name, payload := range sshShellPayloads {
		t.Run(name, func(t *testing.T) {
			work := t.TempDir()
			t.Chdir(work)
			stubDir, _ := harness.WriteStubs(t)
			t.Setenv("PATH", stubDir+string(os.PathListSeparator)+os.Getenv("PATH"))

			_ = git.TestRepo("ssh://git@127.0.0.1:1/org/repo.git", git.NopCreds{}, false, false, payload, "")
			require.False(t, harness.DirContainsName(work, marker),
				"the connection-test proxy path ran the hostname as shell syntax: %s", harness.Describe(payload))
		})
	}
}
