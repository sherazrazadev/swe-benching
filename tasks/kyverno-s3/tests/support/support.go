package vtesting

// Shared harness for the behavioural suites. Everything here is test bookkeeping:
// a recording raw client, a recording/live ConfigMap resolver, policy fixtures and
// builders for the declared data sources.

import (
	"context"
	"io"
	"sync"
	"testing"

	kv1 "github.com/kyverno/kyverno/api/kyverno/v1"
	"github.com/kyverno/kyverno/pkg/config"
	eapi "github.com/kyverno/kyverno/pkg/engine/api"
	ectx "github.com/kyverno/kyverno/pkg/engine/context"
	"github.com/kyverno/kyverno/pkg/engine/factories"
	jpkg "github.com/kyverno/kyverno/pkg/engine/jmespath"
	"github.com/kyverno/kyverno/pkg/toggle"
	c1 "k8s.io/api/core/v1"
	meta1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type hiddenToggles struct{ toggle.Toggles }

func (hiddenToggles) EnableDeferredLoading() bool { return false }

func hiddenBaseContext() context.Context {
	return toggle.NewContext(context.Background(), hiddenToggles{})
}

type hiddenRawClient struct {
	mu    sync.Mutex
	paths []string
}

func (c *hiddenRawClient) RawAbsPath(ctx context.Context, path string, method string, dataReader io.Reader) ([]byte, error) {
	c.mu.Lock()
	c.paths = append(c.paths, method+" "+path)
	c.mu.Unlock()
	return []byte(`{"kind":"List","items":[]}`), nil
}

func (c *hiddenRawClient) recordedPaths() []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]string, len(c.paths))
	copy(out, c.paths)
	return out
}

type hiddenConfigMapResolver struct {
	mu    sync.Mutex
	calls []string
}

func (r *hiddenConfigMapResolver) Get(ctx context.Context, namespace string, name string) (*c1.ConfigMap, error) {
	r.mu.Lock()
	r.calls = append(r.calls, namespace+"/"+name)
	r.mu.Unlock()
	return &c1.ConfigMap{
		ObjectMeta: meta1.ObjectMeta{Namespace: namespace, Name: name},
		Data:       map[string]string{"value": "fixture"},
	}, nil
}

func (r *hiddenConfigMapResolver) recordedCalls() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]string, len(r.calls))
	copy(out, r.calls)
	return out
}

type hiddenHarness struct {
	jp          jpkg.Interface
	jsonContext ectx.Interface
	client      *hiddenRawClient
	resolver    eapi.ConfigmapResolver
}

func newHiddenHarness() *hiddenHarness {
	jp := jpkg.New(config.NewDefaultConfiguration(false))
	return &hiddenHarness{
		jp:          jp,
		jsonContext: ectx.NewContext(jp),
		client:      &hiddenRawClient{},
		resolver:    &hiddenConfigMapResolver{},
	}
}

// load drives the product's own context-loading entry point: build the loader the
// engine builds for a policy, then load the declared context entries into a fresh
// JSON context.
func (h *hiddenHarness) load(policy kv1.PolicyInterface, entries []kv1.ContextEntry) error {
	factory := factories.DefaultContextLoaderFactory(h.resolver)
	loader := factory(policy, kv1.Rule{})
	return loader.Load(hiddenBaseContext(), h.jp, eapi.RawClient(h.client), nil, entries, h.jsonContext)
}

func hiddenNamespacedPolicy(namespace string) kv1.PolicyInterface {
	return &kv1.Policy{ObjectMeta: meta1.ObjectMeta{Name: "hidden-policy", Namespace: namespace}}
}

func hiddenClusterPolicy() kv1.PolicyInterface {
	return &kv1.ClusterPolicy{ObjectMeta: meta1.ObjectMeta{Name: "hidden-cluster-policy"}}
}

func hiddenAPICallEntry(name string, urlPath string, method kv1.Method) kv1.ContextEntry {
	return kv1.ContextEntry{
		Name: name,
		APICall: &kv1.ContextAPICall{
			APICall: kv1.APICall{URLPath: urlPath, Method: method},
		},
	}
}

func hiddenConfigMapEntry(name string, namespace string, configMap string) kv1.ContextEntry {
	return kv1.ContextEntry{
		Name:      name,
		ConfigMap: &kv1.ConfigMapReference{Name: configMap, Namespace: namespace},
	}
}

func hiddenResourceEntry(name, group, version, resource, namespace, object string) kv1.ContextEntry {
	return kv1.ContextEntry{
		Name: name,
		Resource: &kv1.ResourceReference{
			Group:     group,
			Version:   version,
			Resource:  resource,
			Namespace: namespace,
			Name:      object,
		},
	}
}

// hiddenAssertRefused asserts the attack produced a client error and no request was made.
func hiddenAssertRefused(t *testing.T, h *hiddenHarness, err error) {
	t.Helper()
	if err == nil {
		t.Fatalf("the context entry was accepted for a namespaced policy")
	}
	if paths := h.client.recordedPaths(); len(paths) != 0 {
		t.Fatalf("the refused context entry still caused API requests: %v", paths)
	}
}

// hiddenAssertNotBound asserts an entry name carries no data in the context.
func hiddenAssertNotBound(t *testing.T, h *hiddenHarness, name string) {
	t.Helper()
	if value, err := h.jsonContext.Query(name); err == nil && value != nil {
		t.Fatalf("a refused entry was bound into the context: %v", value)
	}
}

// hiddenAssertBound asserts an entry name carries data in the context.
func hiddenAssertBound(t *testing.T, h *hiddenHarness, name string) {
	t.Helper()
	value, err := h.jsonContext.Query(name)
	if err != nil || value == nil {
		t.Fatalf("the entry was not bound into the context: value=%v err=%v", value, err)
	}
}
