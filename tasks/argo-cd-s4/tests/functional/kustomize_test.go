package functional

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"argocdhidden/harness"
)

// TestKustomizeRemoteBaseWithValidProxy keeps a kustomize build with a well-formed SOCKS5 proxy
// succeeding, and keeps the configured destination reaching whatever mechanism applies it
// (a git wrapper on the subprocess PATH, or the subprocess environment itself).
func TestKustomizeRemoteBaseWithValidProxy(t *testing.T) {
	const destination = "127.0.0.1:1080"

	env, err := harness.BuildKustomizeEnvWithProxy(t, "socks5://"+destination)
	require.NoError(t, err, "a build with a well-formed proxy must still succeed")

	found := false
	for _, entry := range env {
		if strings.HasPrefix(entry, "GIT_SSH_COMMAND=") && strings.Contains(entry, destination) {
			found = true
		}
		if pathValue, ok := strings.CutPrefix(entry, "PATH="); ok {
			for _, dir := range filepath.SplitList(pathValue) {
				data, readErr := os.ReadFile(filepath.Join(dir, "git"))
				if readErr == nil && strings.Contains(string(data), destination) {
					found = true
				}
			}
		}
	}
	require.True(t, found, "a well-formed proxy must still reach the kustomize subprocess environment")

	appDir, err := harness.BuildKustomizeWithProxy(t, "socks5://"+destination)
	require.NoError(t, err, "a build with a well-formed proxy must still succeed")
	require.False(t, harness.DirContainsName(appDir, marker))
}
