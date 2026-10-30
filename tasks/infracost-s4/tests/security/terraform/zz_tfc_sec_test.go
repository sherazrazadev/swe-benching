package terraform

import (
	"context"
	"net/http"
	"net/url"
	"reflect"
	"testing"

	tgterraform "github.com/gruntwork-io/terragrunt/terraform"

	"github.com/infracost/infracost/internal/config"
	"github.com/infracost/infracost/internal/hcl"
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

	if has, host := zzProbeSeenAuth(rt.Seen()); has {
		t.Fatalf("the registry token was sent to a host that only shares a suffix with the trusted host (%s)", host)
	}
}

// TestSecZZTerragruntProviderWiredGetter: the product fetches tfr:// modules
// through the getter wired here. If that getter is still the dependency's
// implementation it attaches the registry token to whatever host the module
// source names, so hardening an unused copy of the code would not protect the
// product. A wrapper that replaces it is fine; the vulnerable dependency type
// is not.
func TestSecZZTerragruntProviderWiredGetter(t *testing.T) {
	ctx := config.NewProjectContext(config.EmptyRunContext(), &config.Project{}, nil)
	provider, ok := NewTerragruntHCLProvider(hcl.RootPath{}, ctx).(*TerragruntHCLProvider)
	if !ok {
		t.Fatal("NewTerragruntHCLProvider did not return the terragrunt provider")
	}

	typ := zzProbeWiredGetterType(t, provider.packageFetcher)
	if typ == reflect.TypeOf(&tgterraform.RegistryGetter{}) {
		t.Fatal("the module fetcher is still wired to the dependency registry getter, which attaches the registry token to any module-source host")
	}
}

// zzProbeWiredGetterType returns the concrete type of the "tfr" getter wired
// into a package fetcher. It reads the (unexported) getter map through
// reflection so the test tracks the real product wiring rather than a helper.
func zzProbeWiredGetterType(t *testing.T, fetcher interface{}) reflect.Type {
	t.Helper()

	fv := reflect.ValueOf(fetcher)
	if fv.Kind() != reflect.Ptr || fv.IsNil() {
		t.Fatalf("package fetcher is %s, want a non-nil pointer", fv.Kind())
	}
	field := fv.Elem().FieldByName("getters")
	if !field.IsValid() || field.Kind() != reflect.Map {
		t.Fatal("package fetcher has no getter map")
	}
	entry := field.MapIndex(reflect.ValueOf("tfr"))
	if !entry.IsValid() {
		t.Fatal("no tfr getter is wired into the package fetcher")
	}
	if entry.Kind() != reflect.Interface {
		return entry.Type()
	}
	concrete := entry.Elem()
	if !concrete.IsValid() {
		t.Fatal("the wired tfr getter is nil")
	}
	return concrete.Type()
}
