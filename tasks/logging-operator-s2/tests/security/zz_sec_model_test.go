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

func resourcesWithOutput(out v1beta1.Output, mutate func(*v1beta1.Flow)) model.LoggingResources {
	return model.LoggingResources{
		Logging: testLogging(),
		Fluentd: model.FluentdLoggingResources{
			Outputs: model.Outputs{out},
			Flows:   []v1beta1.Flow{flowTo(out.Namespace, out.Name, mutate)},
		},
	}
}

// A value written for one output setting must not add a configuration line.
func TestSec_OutputParamValueNewline(t *testing.T) {
	out := v1beta1.Output{
		ObjectMeta: metav1.ObjectMeta{Name: "out", Namespace: "ns"},
		Spec: v1beta1.OutputSpec{HTTPOutput: &output.HTTPOutputConfig{
			Endpoint: "http://collector/logs\n" + secMarker,
		}},
	}
	config, err := renderSystem(t, resourcesWithOutput(out, nil), secretReader{})
	assertNoInjection(t, config, err)
}

// The same, with a carriage return as the only line terminator.
func TestSec_OutputParamValueCarriageReturn(t *testing.T) {
	out := v1beta1.Output{
		ObjectMeta: metav1.ObjectMeta{Name: "out", Namespace: "ns"},
		Spec: v1beta1.OutputSpec{HTTPOutput: &output.HTTPOutputConfig{
			Endpoint: "http://collector/logs\r" + secMarker,
		}},
	}
	config, err := renderSystem(t, resourcesWithOutput(out, nil), secretReader{})
	assertNoInjection(t, config, err)
}

// A user-supplied record key must not become a configuration line.
func TestSec_RecordKeyNewline(t *testing.T) {
	out := nullOutput("out", "ns")
	res := resourcesWithOutput(out, func(f *v1beta1.Flow) {
		f.Spec.Filters = []v1beta1.Filter{{RecordTransformer: &filter.RecordTransformer{
			Records: []filter.Record{{"recordkey\n" + secMarker: "value"}},
		}}}
	})
	config, err := renderSystem(t, res, secretReader{})
	assertNoInjection(t, config, err)
}

// A user-supplied record value must not add a configuration line.
func TestSec_RecordValueNewline(t *testing.T) {
	out := nullOutput("out", "ns")
	res := resourcesWithOutput(out, func(f *v1beta1.Flow) {
		f.Spec.Filters = []v1beta1.Filter{{RecordTransformer: &filter.RecordTransformer{
			Records: []filter.Record{{"recordkey": "recordvalue\n" + secMarker}},
		}}}
	})
	config, err := renderSystem(t, res, secretReader{})
	assertNoInjection(t, config, err)
}

// A flow label must not break out of the directive header it names.
func TestSec_FlowLabelNewline(t *testing.T) {
	out := nullOutput("out", "ns")
	res := resourcesWithOutput(out, func(f *v1beta1.Flow) {
		f.Spec.FlowLabel = "label\n" + secMarker
	})
	config, err := renderSystem(t, res, secretReader{})
	assertNoInjection(t, config, err)
}

// A filter match pattern must not break out of the directive header it names.
func TestSec_MatchTagNewline(t *testing.T) {
	out := nullOutput("out", "ns")
	res := resourcesWithOutput(out, func(f *v1beta1.Flow) {
		f.Spec.Filters = []v1beta1.Filter{{TagNormaliser: &filter.TagNormaliser{
			MatchTag: "kubernetes.**\n" + secMarker,
		}}}
	})
	config, err := renderSystem(t, res, secretReader{})
	assertNoInjection(t, config, err)
}

// A relabel target must not break out of the line it is written on.
func TestSec_RelabelLabelNewline(t *testing.T) {
	out := v1beta1.Output{
		ObjectMeta: metav1.ObjectMeta{Name: "out", Namespace: "ns"},
		Spec: v1beta1.OutputSpec{RelabelOutputConfig: &output.RelabelOutputConfig{
			Label: "@target\n" + secMarker,
		}},
	}
	config, err := renderSystem(t, resourcesWithOutput(out, nil), secretReader{})
	assertNoInjection(t, config, err)
}

// A selector value is combined with other data before it is written; it must
// still stay inside its position.
func TestSec_ClusterFlowSelectorNewline(t *testing.T) {
	res := model.LoggingResources{
		Logging: testLogging(),
		Fluentd: model.FluentdLoggingResources{
			ClusterOutputs: model.ClusterOutputs{nullClusterOutput("clusterout")},
			ClusterFlows: []v1beta1.ClusterFlow{{
				ObjectMeta: metav1.ObjectMeta{Name: "clusterflow", Namespace: "ns"},
				Spec: v1beta1.ClusterFlowSpec{
					Match: []v1beta1.ClusterMatch{{ClusterSelect: &v1beta1.ClusterSelect{
						Labels: map[string]string{"app": "demo\n" + secMarker},
					}}},
					GlobalOutputRefs: []string{"clusterout"},
				},
			}},
		},
	}
	config, err := renderSystem(t, res, secretReader{})
	assertNoInjection(t, config, err)
}

// A value that the operator loads from a Kubernetes secret on the user's behalf
// must not add a configuration line either.
func TestSec_SecretLoadedValueNewline(t *testing.T) {
	reader := secretReader{items: []corev1.Secret{{
		ObjectMeta: metav1.ObjectMeta{Name: "credentials", Namespace: "ns"},
		Data:       map[string][]byte{"password": []byte("secretvalue\n" + secMarker)},
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
	assertNoInjection(t, config, err)
}
