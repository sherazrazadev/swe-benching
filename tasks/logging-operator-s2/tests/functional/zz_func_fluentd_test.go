package fluentd

import (
	"strings"
	"testing"

	"github.com/kube-logging/logging-operator/pkg/sdk/logging/api/v1beta1"
)

// The default aggregator configuration keeps its exact form.
func TestFunc_InputConfigDefaults(t *testing.T) {
	files, err := buildConfigFiles(t, v1beta1.FluentdSpec{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	input := fileContent(t, files, "input.conf")
	for _, want := range []string{
		"\n<system>\n",
		"\n  rpc_endpoint 127.0.0.1:24444\n",
		"\n  root_dir /buffers\n",
		"\n</system>\n",
	} {
		if !strings.Contains(input, want) {
			t.Fatalf("input.conf does not contain %q:\n%s", want, input)
		}
	}
	if strings.Contains(input, "zzinjectedmarker") {
		t.Fatalf("input.conf contains an unexpected marker:\n%s", input)
	}
}

// Configured values keep producing the same lines.
func TestFunc_InputConfigValuesUnchanged(t *testing.T) {
	files, err := buildConfigFiles(t, v1beta1.FluentdSpec{
		RootDir:               "/var/log/fluentd",
		IgnoreSameLogInterval: "5s",
		LogLevel:              "info",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	input := fileContent(t, files, "input.conf")
	for _, want := range []string{
		"\n  root_dir /var/log/fluentd\n",
		"\n  ignore_same_log_interval 5s\n",
		"\n  log_level info\n",
	} {
		if !strings.Contains(input, want) {
			t.Fatalf("input.conf does not contain %q:\n%s", want, input)
		}
	}
}

// Extra system parameters keep rendering as system lines.
func TestFunc_SystemParametersUnchanged(t *testing.T) {
	files, err := buildConfigFiles(t, v1beta1.FluentdSpec{
		SystemParameters: map[string]string{"workers": "4", "root_dir": "/data"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	input := fileContent(t, files, "input.conf")
	for _, want := range []string{
		"\n  workers 4\n",
		"\n  root_dir /data\n",
	} {
		if !strings.Contains(input, want) {
			t.Fatalf("input.conf does not contain %q:\n%s", want, input)
		}
	}
}

// Configured includes keep rendering as include lines.
func TestFunc_ConfigIncludesUnchanged(t *testing.T) {
	files, err := buildConfigFiles(t, v1beta1.FluentdSpec{
		ConfigIncludes: []string{"/fluentd/etc/extra.conf", "/fluentd/etc/more.conf"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	conf := fileContent(t, files, "fluent.conf")
	for _, want := range []string{
		"\n@include /fluentd/etc/input.conf\n",
		"\n@include /fluentd/etc/extra.conf\n",
		"\n@include /fluentd/etc/more.conf\n",
	} {
		if !strings.Contains(conf, want) {
			t.Fatalf("fluent.conf does not contain %q:\n%s", want, conf)
		}
	}
}
