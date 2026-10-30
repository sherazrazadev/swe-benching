package functional

import (
	"strings"
	"testing"

	argoio "github.com/argoproj/argo-cd/gitops-engine/v3/pkg/utils/io"
	"github.com/argoproj/argo-cd/v3/util/git"
	"github.com/stretchr/testify/require"

	"argocdhidden/harness"
)

const marker = "argocd_s4_marker"

// privateKeyPath returns the -i argument of a GIT_SSH_COMMAND string.
func privateKeyPath(t *testing.T, gitSSH string) string {
	t.Helper()
	words, err := harness.ShellWords(gitSSH)
	require.NoError(t, err)
	for i, w := range words {
		if w == "-i" && i+1 < len(words) {
			return words[i+1]
		}
	}
	t.Fatalf("GIT_SSH_COMMAND does not select a private key: %s", gitSSH)
	return ""
}

// TestSSHValidProxiesKeepWorking checks every legitimate proxy form still produces a usable
// proxy command with the right destination, authentication values and temp-file cleanup.
func TestSSHValidProxiesKeepWorking(t *testing.T) {
	cases := []struct {
		name                      string
		proxy, wantHost, wantPort string
		wantUser, wantPass        string
	}{
		{"ipv4", "socks5://127.0.0.1:1080", "127.0.0.1", "1080", "", ""},
		{"dns name", "socks5://proxy.example.com:3128", "proxy.example.com", "3128", "", ""},
		{"authenticated", "socks5://user:password@127.0.0.1:1080", "127.0.0.1", "1080", "user", "password"},
		{"bracketed ipv6", "socks5://[::1]:1080", "::1", "1080", "", ""},
		{"socks5h", "socks5h://proxy.internal:9050", "proxy.internal", "9050", "", ""},
		{"port one", "socks5://proxy.example.com:1", "proxy.example.com", "1", "", ""},
		{"port maximum", "socks5://proxy.example.com:65535", "proxy.example.com", "65535", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			work := t.TempDir()
			stubDir, argsFile := harness.WriteStubs(t)
			before := harness.TempDirFiles(argoio.TempDir)

			creds := git.NewSSHCreds("ssh-private-key", "", false, tc.proxy)
			closer, env, err := creds.Environ()
			require.NoError(t, err, "a well-formed proxy must remain usable")

			gitSSH, ok := harness.GitSSHCommand(env)
			require.True(t, ok, "expected a GIT_SSH_COMMAND")
			require.Contains(t, gitSSH, "-i ", "GIT_SSH_COMMAND must still select the private key")

			value, has := harness.ProxyCommandValue(gitSSH)
			require.True(t, has, "a well-formed proxy must produce a proxy command")
			expected := tc.wantHost + ":" + tc.wantPort
			require.Contains(t, harness.ProxyText(t, value), expected,
				"the proxy command must target the configured address")

			harness.RunProxyValue(t, value, work, stubDir, argsFile)
			require.Contains(t, strings.Join(harness.RecordedArgs(t, argsFile), " "), expected,
				"the proxy connection program must receive the configured address")

			if tc.wantUser != "" {
				require.Contains(t, env, "SOCKS5_USER="+tc.wantUser,
					"the proxy username must still be exported")
				require.Contains(t, env, "SOCKS5_PASSWD="+tc.wantPass,
					"the proxy password must still be exported")
			}

			keyPath := privateKeyPath(t, gitSSH)
			require.True(t, harness.FileExists(keyPath), "the private key file must exist while in use")
			scriptIsFile := harness.FileExists(value)
			require.NoError(t, closer.Close())
			require.False(t, harness.FileExists(keyPath), "the private key file must be removed")
			if scriptIsFile {
				require.False(t, harness.FileExists(value), "a proxy helper file must be removed")
			}
			harness.RequireNoNewFiles(t, before, harness.TempDirFiles(argoio.TempDir))
		})
	}
}

// TestSSHUnparseableProxyKeepsCleanup checks the long-standing behaviour for a proxy value the
// URL parser cannot read: it is refused or dropped, and no temporary key file is left behind.
func TestSSHUnparseableProxyKeepsCleanup(t *testing.T) {
	before := harness.TempDirFiles(argoio.TempDir)
	creds := git.NewSSHCreds("ssh-private-key", "", false, ":invalid-proxy-url")
	closer, env, err := creds.Environ()
	if err == nil {
		if closer != nil {
			_ = closer.Close()
		}
		if gitSSH, ok := harness.GitSSHCommand(env); ok {
			_, used := harness.ProxyCommandValue(gitSSH)
			require.False(t, used, "an unreadable proxy value must not be used")
		}
	}
	harness.RequireNoNewFiles(t, before, harness.TempDirFiles(argoio.TempDir))
}
