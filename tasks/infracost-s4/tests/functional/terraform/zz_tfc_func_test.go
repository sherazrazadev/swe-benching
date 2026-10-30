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
	rt := zzProbeInstallDefaultTransport(t)
	p := &DirProvider{TerraformCloudToken: "zz-probe-tfc-token", TerraformCloudHost: "tfe.mycorp.com"}
	opts := zzProbeStubTerraform(t, "https://tfe.mycorp.com/app/acme/workspace/prod/runs/run-1")

	_, _ = p.runRemotePlan(opts, nil)

	if has, _ := zzProbeSeenAuth(rt.Seen()); !has {
		t.Fatal("the configured trusted host no longer receives its credential; legitimate remote runs are broken")
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
	if has, _ := zzProbeSeenAuth(seen); !has {
		t.Fatal("the registry token was never sent to the trusted public registry")
	}
}

// TestFuncZZRegistryGetterConfiguredPrivateHost: a registry host the operator
// has configured keeps receiving the registry token.
func TestFuncZZRegistryGetterConfiguredPrivateHost(t *testing.T) {
	const privateHost = "registry.mycorp.com"
	t.Setenv("TG_TF_REGISTRY_TOKEN", zzProbeRegistryToken)
	t.Setenv("TERRAFORM_CLOUD_HOST", privateHost)

	rt := &zzProbeRoundTripper{}
	old := httpClient
	httpClient = &http.Client{Transport: rt}
	t.Cleanup(func() { httpClient = old })

	src := &url.URL{Scheme: "tfr", Host: privateHost, Path: "/acme/mod/aws", RawQuery: "version=1.0.0"}
	g := &TerraformRegistryGetter{}
	_ = g.Get(context.Background(), t.TempDir(), src)

	for _, r := range rt.Seen() {
		if r.host == privateHost && r.auth != "" {
			return
		}
	}
	t.Fatalf("a configured private registry host (%s) no longer receives the registry token", privateHost)
}
