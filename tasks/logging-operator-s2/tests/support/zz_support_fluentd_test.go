// Test support for the fluentd resources suites.
package fluentd

import (
	"strings"
	"testing"

	"github.com/kube-logging/logging-operator/pkg/sdk/logging/api/v1beta1"
)

const secMarker = "zzinjectedmarker"

// generateConfig drives the reconciler function that builds the fluentd config
// files (called for the real config secret and for the config-check secret).
func buildConfigFiles(t *testing.T, spec v1beta1.FluentdSpec) (map[string][]byte, error) {
	t.Helper()
	r := &Reconciler{}
	return r.generateConfigSecret(spec)
}

func assertNoInjection(t *testing.T, files map[string][]byte, err error) {
	t.Helper()
	if err != nil {
		return
	}
	for name, content := range files {
		for _, token := range strings.FieldsFunc(string(content), func(r rune) bool { return r == '\n' || r == '\r' }) {
			if strings.HasPrefix(strings.TrimSpace(token), secMarker) {
				t.Fatalf("a supplied value escaped its position in %s:\n%s", name, string(content))
			}
		}
	}
}

func fileContent(t *testing.T, files map[string][]byte, name string) string {
	t.Helper()
	content, ok := files[name]
	if !ok {
		t.Fatalf("generated files lack %q", name)
	}
	return string(content)
}
