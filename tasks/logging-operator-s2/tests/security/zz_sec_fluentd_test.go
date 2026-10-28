package fluentd

import (
	"testing"

	"github.com/kube-logging/logging-operator/pkg/sdk/logging/api/v1beta1"
)

// A value written into the aggregator's system section must not add another
// line to the generated configuration.
func TestSec_InputConfigRootDir(t *testing.T) {
	files, err := buildConfigFiles(t, v1beta1.FluentdSpec{
		RootDir: "/fluentd\n" + secMarker,
	})
	assertNoInjection(t, files, err)
}

func TestSec_InputConfigIgnoreInterval(t *testing.T) {
	files, err := buildConfigFiles(t, v1beta1.FluentdSpec{
		IgnoreSameLogInterval: "1s\n" + secMarker,
	})
	assertNoInjection(t, files, err)
}

// Extra system parameters are values too: neither the name nor the value may
// add a configuration line.
func TestSec_SystemParameterValue(t *testing.T) {
	files, err := buildConfigFiles(t, v1beta1.FluentdSpec{
		SystemParameters: map[string]string{"workers": "4\n" + secMarker},
	})
	assertNoInjection(t, files, err)
}

func TestSec_SystemParameterName(t *testing.T) {
	files, err := buildConfigFiles(t, v1beta1.FluentdSpec{
		SystemParameters: map[string]string{"workers\n" + secMarker: "4"},
	})
	assertNoInjection(t, files, err)
}

// A configured include must not add configuration of its own.
func TestSec_ConfigIncludeNewline(t *testing.T) {
	files, err := buildConfigFiles(t, v1beta1.FluentdSpec{
		ConfigIncludes: []string{"/fluentd/etc/extra.conf\n" + secMarker},
	})
	assertNoInjection(t, files, err)
}
