package security

import (
	"testing"

	"github.com/argoproj/argo-cd/v3/pkg/apis/application/v1alpha1"
	"github.com/argoproj/argo-cd/v3/util/git"
	"github.com/stretchr/testify/require"

	"argocdhidden/harness"
)

// TestMergedCredentialTemplateProxyCannotRunShell drives the proxy value through the stored
// credential-template merge and the repository credential accessor, which is how a template's
// proxy reaches an SSH repository that does not carry its own.
func TestMergedCredentialTemplateProxyCannotRunShell(t *testing.T) {
	for name, payload := range sshShellPayloads {
		t.Run(name, func(t *testing.T) {
			work := t.TempDir()
			stubDir, argsFile := harness.WriteStubs(t)

			template := &v1alpha1.RepoCreds{Proxy: payload}
			repo := &v1alpha1.Repository{
				Repo:          "ssh://git@example.com/org/repo.git",
				SSHPrivateKey: "ssh-private-key",
			}
			repo.CopyCredentialsFrom(template)
			require.Equal(t, payload, repo.Proxy, "the template proxy must reach the repository")

			creds := repo.GetGitCreds(git.NoopCredsStore{})
			closer, env, err := creds.Environ()
			if err != nil {
				return
			}
			defer func() { _ = closer.Close() }()

			gitSSH, ok := harness.GitSSHCommand(env)
			require.True(t, ok, "expected a GIT_SSH_COMMAND")
			harness.RunGitSSHCommand(t, gitSSH, work, stubDir, argsFile)
			if value, has := harness.ProxyCommandValue(gitSSH); has {
				harness.RunProxyValue(t, value, work, stubDir, argsFile)
			}
			require.False(t, harness.DirContainsName(work, marker),
				"a proxy merged from stored configuration ran as shell syntax")
		})
	}
}
