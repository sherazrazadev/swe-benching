package terraform

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/hcl"
	"github.com/infracost/infracost/internal/hcl/modules"
)

const zzProbeRegistryToken = "zz-probe-registry-token"

// TestSecZZRemotePlanAttackerHost: a remote run hosted on a host that is not
// the configured Terraform Cloud host must never receive the configured token.
func TestSecZZRemotePlanAttackerHost(t *testing.T) {
	rt := zzProbeInstallDefaultTransport(t)
	p := &DirProvider{TerraformCloudToken: "zz-probe-tfc-token"}
	opts := zzProbeStubTerraform(t, "https://attacker.example/app/acme/workspace/prod/runs/run-1")

	_, _ = p.runRemotePlan(opts, nil)

	if has, host := zzProbeSeenAuth(rt.Seen()); has {
		t.Fatalf("the Terraform Cloud token was sent to a host named by the remote-run output (%s)", host)
	}
}

// TestSecZZRemotePlanAttackerHostWithConfiguredHost: the same must hold when a
// different trusted host has been configured.
func TestSecZZRemotePlanAttackerHostWithConfiguredHost(t *testing.T) {
	rt := zzProbeInstallDefaultTransport(t)
	p := &DirProvider{
		TerraformCloudToken: "zz-probe-tfc-token",
		TerraformCloudHost:  "tfe.mycorp.com",
	}
	opts := zzProbeStubTerraform(t, "https://attacker.example/app/acme/workspace/prod/runs/run-1")

	_, _ = p.runRemotePlan(opts, nil)

	if has, host := zzProbeSeenAuth(rt.Seen()); has {
		t.Fatalf("the Terraform Cloud token was sent to a host named by the remote-run output (%s)", host)
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

	if has, host := zzProbeSeenAuth(rt.Seen()); has {
		t.Fatalf("the registry token was sent to a host named by the module source (%s)", host)
	}
}

// TestSecZZRegistryGetterSuffixShareHost: a host that merely shares a suffix
// with a trusted registry name is a different host.
func TestSecZZRegistryGetterSuffixShareHost(t *testing.T) {
	t.Setenv("TG_TF_REGISTRY_TOKEN", zzProbeRegistryToken)

	rt := &zzProbeRoundTripper{}
	old := httpClient
	httpClient = &http.Client{Transport: rt}
	t.Cleanup(func() { httpClient = old })

	for _, host := range []string{
		"registry.terraform.io.attacker.example",
		"evilregistry.terraform.io",
		"x.terraform.io",
	} {
		src := &url.URL{
			Scheme:   "tfr",
			Host:     host,
			Path:     "/acme/mod/aws",
			RawQuery: "version=1.0.0",
		}
		g := &TerraformRegistryGetter{}
		_ = g.Get(context.Background(), t.TempDir(), src)

		if has, sent := zzProbeSeenAuth(rt.Seen()); has {
			t.Fatalf("the registry token was sent to a host that only shares a suffix with the trusted host (%s -> %s)", host, sent)
		}
	}
}

// TestSecZZTerragruntProviderWiredGetter: the product fetches tfr:// modules
// through the getter wired into its module fetcher. Driving that real fetch
// with an untrusted module-source host must not deliver the registry token,
// whichever getter implementation is wired in.
func TestSecZZTerragruntProviderWiredGetter(t *testing.T) {
	t.Setenv("TG_TF_REGISTRY_TOKEN", zzProbeRegistryToken)
	t.Setenv("TERRAFORM_CLOUD_HOST", "")
	t.Setenv("TG_TF_DEFAULT_REGISTRY_HOST", "")

	srv := zzProbeStartRegistryServer(t)
	modules.ResetGlobalModuleCache()

	ctx := config.NewProjectContext(config.EmptyRunContext(), &config.Project{}, nil)
	provider, ok := NewTerragruntHCLProvider(hcl.RootPath{}, ctx).(*TerragruntHCLProvider)
	if !ok {
		t.Fatal("NewTerragruntHCLProvider did not return the terragrunt provider")
	}

	_ = zzProbeRegistryFetch(t, provider, "tfr://"+srv.Host()+"/acme/mod/aws?version=1.0.0")

	if has, host := zzProbeSeenAuth(srv.Seen()); has {
		t.Fatalf("the module fetcher sent the registry token to a host named by the module source (%s)", host)
	}
}
