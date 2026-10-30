package functional

import (
	"os"
	"strings"
	"testing"

	"github.com/argoproj/argo-cd/v3/util/git"
	"github.com/stretchr/testify/require"

	"argocdhidden/harness"
)

// TestSSHConnectionTestUsesValidProxy keeps the repository connection test reaching a
// well-formed proxy before it contacts the repository.
func TestSSHConnectionTestUsesValidProxy(t *testing.T) {
	work := t.TempDir()
	t.Chdir(work)
	stubDir, argsFile := harness.WriteStubs(t)
	t.Setenv("PATH", stubDir+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("PROXY_ARGS_FILE", argsFile)

	_ = git.TestRepo("ssh://git@127.0.0.1:1/org/repo.git", git.NopCreds{}, false, false,
		"socks5://user:password@127.0.0.1:1080", "")

	require.Contains(t, strings.Join(harness.RecordedArgs(t, argsFile), " "), "127.0.0.1:1080",
		"the connection test must still check a well-formed proxy")
}
