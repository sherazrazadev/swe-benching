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
// has configured keeps receiving the registry token. It drives the getter the
// product actually wires and supplies the configured host the way the product
// resolves it, so any correct implementation that honours the operator's
// configured host passes.
func TestFuncZZRegistryGetterConfiguredPrivateHost(t *testing.T) {
	t.Setenv("TG_TF_REGISTRY_TOKEN", zzProbeRegistryToken)

	srv := zzProbeStartRegistryServer(t)
	privateHost := srv.Host()
	t.Setenv("TERRAFORM_CLOUD_HOST", privateHost)

	modules.ResetGlobalModuleCache()
	ctx := config.NewProjectContext(config.EmptyRunContext(), &config.Project{TerraformCloudHost: privateHost}, nil)
	provider, ok := NewTerragruntHCLProvider(hcl.RootPath{}, ctx).(*TerragruntHCLProvider)
	if !ok {
		t.Fatal("NewTerragruntHCLProvider did not return the terragrunt provider")
	}
	_ = zzProbeRegistryFetch(t, provider, "tfr://"+privateHost+"/acme/mod/aws?version=1.0.0")

	if has, host := zzProbeSeenAuth(srv.Seen()); !has {
		t.Fatalf("a configured private registry host (%s) no longer receives the registry token", host)
	}
}
