package functional

import (
	"strings"
	"testing"

	"github.com/argoproj/argo-cd/v3/pkg/apis/application/v1alpha1"
	"github.com/argoproj/argo-cd/v3/util/git"
	"github.com/stretchr/testify/require"

	"argocdhidden/harness"
)

// TestMergedCredentialTemplateProxyKeepsWorking keeps a well-formed proxy that arrives through a
// stored credential template usable by the repository credential accessor.
func TestMergedCredentialTemplateProxyKeepsWorking(t *testing.T) {
	work := t.TempDir()
	stubDir, argsFile := harness.WriteStubs(t)

	template := &v1alpha1.RepoCreds{Proxy: "socks5://user:password@127.0.0.1:1080"}
	repo := &v1alpha1.Repository{
		Repo:          "ssh://git@example.com/org/repo.git",
		SSHPrivateKey: "ssh-private-key",
	}
	repo.CopyCredentialsFrom(template)
	require.Equal(t, template.Proxy, repo.Proxy)

	creds := repo.GetGitCreds(git.NoopCredsStore{})
	closer, env, err := creds.Environ()
	require.NoError(t, err, "a well-formed merged proxy must remain usable")
	defer func() { _ = closer.Close() }()

	gitSSH, ok := harness.GitSSHCommand(env)
	require.True(t, ok, "expected a GIT_SSH_COMMAND")
	value, has := harness.ProxyCommandValue(gitSSH)
	require.True(t, has, "a well-formed merged proxy must produce a proxy command")
	require.Contains(t, harness.ProxyText(t, value), "127.0.0.1:1080")

	harness.RunProxyValue(t, value, work, stubDir, argsFile)
	require.Contains(t, strings.Join(harness.RecordedArgs(t, argsFile), " "), "127.0.0.1:1080")
	require.Contains(t, env, "SOCKS5_USER=user")
	require.Contains(t, env, "SOCKS5_PASSWD=password")
}
