package model_test

import (
	"testing"

	"github.com/cisco-open/operator-tools/pkg/secret"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kube-logging/logging-operator/pkg/resources/model"
	"github.com/kube-logging/logging-operator/pkg/sdk/logging/api/v1beta1"
	"github.com/kube-logging/logging-operator/pkg/sdk/logging/model/filter"
	"github.com/kube-logging/logging-operator/pkg/sdk/logging/model/output"
)

// An ordinary output keeps producing the same configuration.
func TestFunc_OutputConfigUnchanged(t *testing.T) {
	out := v1beta1.Output{
		ObjectMeta: metav1.ObjectMeta{Name: "out", Namespace: "ns"},
		Spec: v1beta1.OutputSpec{HTTPOutput: &output.HTTPOutputConfig{
			Endpoint:   "http://collector.example:8080/logs",
			HTTPMethod: "post",
		}},
	}
	config, err := renderSystem(t, resourcesWithOutput(out, nil), secretReader{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertContains(t, config,
		"\n    @type http\n",
		"\n    @id flow:ns:flow:output:ns:out\n",
		"\n    endpoint http://collector.example:8080/logs\n",
		"\n    http_method post\n",
		"\n    <buffer tag,time>\n",
	)
}

// Values the operator derives itself are consumed structurally by fluentd and
// must keep their exact form.
func TestFunc_StructuredSelectorsUnchanged(t *testing.T) {
	res := model.LoggingResources{
		Logging: testLogging(),
		Fluentd: model.FluentdLoggingResources{
			ClusterOutputs: model.ClusterOutputs{nullClusterOutput("clusterout")},
			ClusterFlows: []v1beta1.ClusterFlow{{
				ObjectMeta: metav1.ObjectMeta{Name: "clusterflow", Namespace: "ns"},
				Spec: v1beta1.ClusterFlowSpec{
					Match: []v1beta1.ClusterMatch{{ClusterSelect: &v1beta1.ClusterSelect{
						Labels:          map[string]string{"app": "demo", "env": "prod"},
						NamespaceLabels: map[string]string{"team": "blue"},
						Namespaces:      []string{"ns1", "ns2"},
						ContainerNames:  []string{"web", "api"},
					}}},
					GlobalOutputRefs: []string{"clusterout"},
				},
			}},
		},
	}
	config, err := renderSystem(t, res, secretReader{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertContains(t, config,
		"\n      labels app:demo,env:prod\n",
		"\n      namespace_labels team:blue\n",
		"\n      namespaces ns1,ns2\n",
		"\n      container_names web,api\n",
	)
}

// A record map is written as parameter lines and must keep its exact form.
func TestFunc_RecordMapUnchanged(t *testing.T) {
	out := nullOutput("out", "ns")
	res := resourcesWithOutput(out, func(f *v1beta1.Flow) {
		f.Spec.Filters = []v1beta1.Filter{{RecordTransformer: &filter.RecordTransformer{
			Records: []filter.Record{{"app": "demo", "labels": `{"a":"b"}`}},
		}}}
	})
	config, err := renderSystem(t, res, secretReader{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertContains(t, config, "app demo", `labels {"a":"b"}`)
}

// A value loaded from a secret keeps its exact bytes when it contains no line break.
func TestFunc_SecretValueUnchanged(t *testing.T) {
	reader := secretReader{items: []corev1.Secret{{
		ObjectMeta: metav1.ObjectMeta{Name: "credentials", Namespace: "ns"},
		Data:       map[string][]byte{"password": []byte(`pa"ss\word`)},
	}}}
	out := v1beta1.Output{
		ObjectMeta: metav1.ObjectMeta{Name: "out", Namespace: "ns"},
		Spec: v1beta1.OutputSpec{HTTPOutput: &output.HTTPOutputConfig{
			Endpoint: "http://collector/logs",
			Auth: &output.HTTPAuth{Password: &secret.Secret{
				ValueFrom: &secret.ValueFrom{SecretKeyRef: &corev1.SecretKeySelector{
					LocalObjectReference: corev1.LocalObjectReference{Name: "credentials"},
					Key:                  "password",
				}},
			}},
		}},
	}
	config, err := renderSystem(t, resourcesWithOutput(out, nil), reader)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertContains(t, config, "\n      password pa\"ss\\word\n")
}

// Ordinary characters that appear inside a value are not escaped today and must not be.
func TestFunc_SpecialCharactersUnchanged(t *testing.T) {
	out := v1beta1.Output{
		ObjectMeta: metav1.ObjectMeta{Name: "out", Namespace: "ns"},
		Spec: v1beta1.OutputSpec{HTTPOutput: &output.HTTPOutputConfig{
			Endpoint: "http://collector/logs?a=1&b=2#frag",
			Headers:  map[string]string{"X-Env": "prod"},
		}},
	}
	config, err := renderSystem(t, resourcesWithOutput(out, nil), secretReader{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertContains(t, config, "\n    endpoint http://collector/logs?a=1&b=2#frag\n")
	assertContains(t, config, `headers {"X-Env":"prod"}`)
}
