package terraform

import (
	"context"
	"net/http"
	"net/url"
	"testing"
)

// TestFuncZZRemotePlanTrustedHostProceeds: a remote run on the configured
// trusted host is still contacted with the configured token.
func TestFuncZZRemotePlanTrustedHostProceeds(t *testing.T) {
	counter := zzProbeStartConnCounter(t)
	host := counter.Host()

	p := &DirProvider{TerraformCloudToken: "zz-probe-tfc-token", TerraformCloudHost: host}
	opts := zzProbeStubTerraform(t, "https://"+host+"/app/acme/workspace/prod/runs/run-1")

	_, _ = p.runRemotePlan(opts, nil)

	if counter.Count() == 0 {
		t.Fatal("the configured trusted host was never contacted; legitimate remote runs no longer work")
	}
}

// TestFuncZZRegistryGetterTrustedHost: the public registry is still allowed to
// receive the registry token.
func TestFuncZZRegistryGetterTrustedHost(t *testing.T) {
	t.Setenv("TG_TF_REGISTRY_TOKEN", zzProbeRegistryToken)

	rt := &zzProbeRoundTripper{}
	old := httpClient
	httpClient = &http.Client{Transport: rt}
	t.Cleanup(func() { httpClient = old })

	src := &url.URL{Scheme: "tfr", Host: "registry.terraform.io", Path: "/acme/mod/aws", RawQuery: "version=1.0.0"}
	g := &TerraformRegistryGetter{}
	_ = g.Get(context.Background(), t.TempDir(), src)

	seen := rt.Seen()
	if len(seen) == 0 {
		t.Fatal("the public registry getter made no request; legitimate registry use no longer works")
	}
	var authed bool
	for _, r := range seen {
		if r.auth != "" {
			authed = true
		}
	}
	if !authed {
		t.Fatal("the registry token was never sent to the trusted public registry")
	}
}
