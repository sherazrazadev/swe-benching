package security

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"argocdhidden/harness"
)

// TestKustomizeRemoteBaseProxyCannotRunShell drives the kustomize build entry point and runs any
// git wrapper it installs on the subprocess PATH for remote-base fetches.
func TestKustomizeRemoteBaseProxyCannotRunShell(t *testing.T) {
	// The generated wrapper quotes the proxy command in double quotes, so the command
	// substitution form is the shape that reaches this sink.
	payload := sshShellPayloads["command substitution"]
	t.Run("command substitution", func(t *testing.T) {
		before := proxyWrapperScripts(t)
		appDir, _ := harness.BuildKustomizeWithProxy(t, payload)
		work := t.TempDir()
		stubDir, argsFile := harness.WriteStubs(t)

		for script := range proxyWrapperScripts(t) {
			if before[script] {
				continue
			}
			data, readErr := os.ReadFile(script)
			if readErr != nil || !strings.Contains(string(data), marker) {
				continue
			}
			harness.RunProxyValue(t, script, work, stubDir, argsFile)
			require.False(t, harness.DirContainsName(work, marker),
				"a kustomize remote-base proxy wrapper ran the hostname as shell syntax")
		}
		require.False(t, harness.DirContainsName(appDir, marker))
	})
}

func proxyWrapperScripts(t *testing.T) map[string]bool {
	t.Helper()
	scripts, err := filepath.Glob(filepath.Join(os.TempDir(), "argocd-git-proxy-*", "git"))
	require.NoError(t, err)
	out := make(map[string]bool, len(scripts))
	for _, s := range scripts {
		out[s] = true
	}
	return out
}
