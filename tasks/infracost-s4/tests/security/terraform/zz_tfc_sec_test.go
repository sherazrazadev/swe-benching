package terraform

import (
	"context"
	"net/http"
	"net/url"
	"testing"
)

const zzProbeRegistryToken = "zz-probe-registry-token"

// TestSecZZRemotePlanAttackerHost: a remote run hosted on a host that is not
// the configured Terraform Cloud host must not receive the configured token.
func TestSecZZRemotePlanAttackerHost(t *testing.T) {
	counter := zzProbeStartConnCounter(t)
	p := &DirProvider{TerraformCloudToken: "zz-probe-tfc-token"}
	opts := zzProbeStubTerraform(t, "https://"+counter.Host()+"/app/acme/workspace/prod/runs/run-1")

	_, _ = p.runRemotePlan(opts, nil)

	if got := counter.Count(); got != 0 {
		t.Fatalf("the Terraform Cloud token was sent to a host named by the remote-run output (%d request(s))", got)
	}
}

// TestSecZZRemotePlanAttackerHostWithConfiguredHost: the same must hold when a
// different trusted host has been configured.
func TestSecZZRemotePlanAttackerHostWithConfiguredHost(t *testing.T) {
	counter := zzProbeStartConnCounter(t)
	p := &DirProvider{
		TerraformCloudToken: "zz-probe-tfc-token",
		TerraformCloudHost:  "tfe.mycorp.com",
	}
	opts := zzProbeStubTerraform(t, "https://"+counter.Host()+"/app/acme/workspace/prod/runs/run-1")

	_, _ = p.runRemotePlan(opts, nil)

	if got := counter.Count(); got != 0 {
		t.Fatalf("the Terraform Cloud token was sent to a host named by the remote-run output (%d request(s))", got)
	}
}

// TestSecZZRegistryGetterUntrustedHost: the registry token must not be attached
// to a registry request whose host is taken from the module source.
func TestSecZZRegistryGetterUntrustedHost(t *testing.T) {
	t.Setenv("TG_TF_REGISTRY_TOKEN", zzProbeRegistryToken)

	rt := &zzProbeRoundTripper{}
	old := httpClient
	httpClient = &http.Client{Transport: rt}
	t.Cleanup(func() { httpClient = old })

	src := &url.URL{Scheme: "tfr", Host: "registry.mycorp.com", Path: "/acme/mod/aws", RawQuery: "version=1.0.0"}
	g := &TerraformRegistryGetter{}
	_ = g.Get(context.Background(), t.TempDir(), src)

	seen := rt.Seen()
	for _, r := range seen {
		if r.auth != "" {
			t.Fatalf("the registry token was sent to a host named by the module source (%s)", r.host)
		}
	}
}

// TestSecZZRegistryGetterSuffixShareHost: a host that merely ends with a
// trusted registry name is a different host.
func TestSecZZRegistryGetterSuffixShareHost(t *testing.T) {
	t.Setenv("TG_TF_REGISTRY_TOKEN", zzProbeRegistryToken)

	rt := &zzProbeRoundTripper{}
	old := httpClient
	httpClient = &http.Client{Transport: rt}
	t.Cleanup(func() { httpClient = old })

	src := &url.URL{
		Scheme:   "tfr",
		Host:     "registry.terraform.io.attacker.example",
		Path:     "/acme/mod/aws",
		RawQuery: "version=1.0.0",
	}
	g := &TerraformRegistryGetter{}
	_ = g.Get(context.Background(), t.TempDir(), src)

	seen := rt.Seen()
	for _, r := range seen {
		if r.auth != "" {
			t.Fatalf("the registry token was sent to a host that only shares a suffix with the trusted host (%s)", r.host)
		}
	}
}
