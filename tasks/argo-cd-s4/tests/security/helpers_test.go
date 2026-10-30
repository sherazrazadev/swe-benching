package security

import (
	"os/exec"
	"testing"

	"github.com/argoproj/argo-cd/v3/util/proxy"
)

// proxyEnv returns the environment the shared subprocess proxy helper prepares.
func proxyEnv(t *testing.T, proxyValue string) []string {
	t.Helper()
	cmd := exec.Command("/bin/true")
	cmd.Env = []string{"PATH=/usr/bin:/bin"}
	return proxy.UpsertEnv(cmd, proxyValue, "example.com")
}
