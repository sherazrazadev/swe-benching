package security

import (
	"testing"

	argoio "github.com/argoproj/argo-cd/gitops-engine/v3/pkg/utils/io"
	"github.com/argoproj/argo-cd/v3/util/git"
	"github.com/stretchr/testify/require"

	"argocdhidden/harness"
)

// marker is the harmless file name the proxy payloads try to create.
const marker = "argocd_s4_marker"

// sshShellPayloads are proxy hostnames that break out of the single-quoted ProxyCommand on
// the vulnerable tree. Spaces, slashes, braces and backticks are rejected by the URL parser, so
// they are not used here.
var sshShellPayloads = map[string]string{
	"command substitution": "socks5://a'$(id>" + marker + ")'b:1080",
	"output redirection":   "socks5://a'>" + marker + "'b:1080",
	"command separator":    "socks5://a';id>" + marker + ";'b:1080",
}

// requireSSHProxyCannotRunShell drives the SSH credential environment builder with proxy and
// fails when any part of the value is interpreted by a shell.
func requireSSHProxyCannotRunShell(t *testing.T, proxy string) {
	t.Helper()
	work := t.TempDir()
	stubDir, argsFile := harness.WriteStubs(t)
	before := harness.TempDirFiles(argoio.TempDir)

	creds := git.NewSSHCreds("ssh-private-key", "", false, proxy)
	closer, env, err := creds.Environ()
	if err != nil {
		// Refusing the value is acceptable, but it must not leak a temporary file.
		harness.RequireNoNewFiles(t, before, harness.TempDirFiles(argoio.TempDir))
		return
	}

	gitSSH, ok := harness.GitSSHCommand(env)
	require.True(t, ok, "expected a GIT_SSH_COMMAND for a proxy value")
	harness.RunGitSSHCommand(t, gitSSH, work, stubDir, argsFile)
	if value, has := harness.ProxyCommandValue(gitSSH); has {
		harness.RunProxyValue(t, value, work, stubDir, argsFile)
	}
	require.False(t, harness.DirContainsName(work, marker),
		"a proxy hostname ran as shell syntax: %s", harness.Describe(proxy))

	require.NoError(t, closer.Close())
	harness.RequireNoNewFiles(t, before, harness.TempDirFiles(argoio.TempDir))
}

func TestSSHProxyHostCannotRunShell(t *testing.T) {
	for name, payload := range sshShellPayloads {
		t.Run(name, func(t *testing.T) {
			requireSSHProxyCannotRunShell(t, payload)
		})
	}
}

// unusableSSHProxies are values that are not well-formed addresses for an SSH repository.
var unusableSSHProxies = map[string]string{
	"port zero":          "socks5://proxy.example.com:0",
	"port too high":      "socks5://proxy.example.com:65536",
	"missing port":       "socks5://proxy.example.com",
	"empty hostname":     "socks5://:1080",
	"http scheme":        "http://proxy.example.com:1080",
	"https scheme":       "https://proxy.example.com:1080",
	"socks4 scheme":      "socks4://proxy.example.com:1080",
	"unsupported scheme": "ftp://proxy.example.com:1080",
}

func TestSSHUnusableProxyValuesAreNotUsed(t *testing.T) {
	for name, value := range unusableSSHProxies {
		t.Run(name, func(t *testing.T) {
			creds := git.NewSSHCreds("ssh-private-key", "", false, value)
			closer, env, err := creds.Environ()
			if err != nil {
				return // a client error is an acceptable refusal
			}
			defer func() { _ = closer.Close() }()
			gitSSH, ok := harness.GitSSHCommand(env)
			require.True(t, ok, "expected a GIT_SSH_COMMAND")
			_, used := harness.ProxyCommandValue(gitSSH)
			require.False(t, used, "an unusable proxy value was used: %s", harness.Describe(value))
		})
	}
}
