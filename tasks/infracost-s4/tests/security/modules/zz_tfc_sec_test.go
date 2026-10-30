package modules

import (
	"testing"

	svchost "github.com/hashicorp/terraform-svchost"
	"github.com/rs/zerolog"
)

const zzProbeBaseToken = "zz-probe-base-token"
const zzProbeRegistryToken = "zz-probe-registry-token"

// TestSecZZModuleDiscoveryHostCredentialFallback: a module source host that has
// no credential of its own must not receive the configured Terraform Cloud
// token.
func TestSecZZModuleDiscoveryHostCredentialFallback(t *testing.T) {
	creds := &CredentialsSource{
		BaseCredentialSet: BaseCredentialSet{Token: zzProbeBaseToken, Host: "app.terraform.io"},
		FetchToken:        func(string) string { return "" },
	}

	rt := &zzProbeRoundTripper{}
	d := NewDisco(creds, zerolog.Nop())
	d.disco.Transport = rt

	_, _, _ = d.ModuleLocation("modules.attacker.example/acme/mod/aws")

	seen := rt.Seen()
	if zzProbeHasAuth(seen) {
		t.Fatalf("the configured Terraform Cloud token was sent to a host named by the module source (%s)", seen[0].host)
	}
}

// TestSecZZModuleVersionsDiscoveryHost: credentials looked up for one registry
// must not be attached to a versions request whose host came from the
// registry's service discovery document.
func TestSecZZModuleVersionsDiscoveryHost(t *testing.T) {
	rt := &zzProbeRoundTripper{}
	r := &RegistryLoader{httpClient: zzProbeRetryableClient(rt), logger: zerolog.Nop()}
	moduleURL := RegistryURL{
		Host:        "registry.mycorp.com",
		Location:    "https://modules.attacker.example/acme/mod/aws",
		Credentials: HostCredentials{token: zzProbeRegistryToken},
	}

	_, _ = r.fetchModuleVersions(moduleURL)

	seen := rt.Seen()
	if zzProbeHasAuth(seen) {
		t.Fatalf("the registry credential was sent to a host named by service discovery (%s)", seen[0].host)
	}
}

// TestSecZZModuleDownloadDiscoveryHost: the same holds for the download URL
// resolved from the service discovery document.
func TestSecZZModuleDownloadDiscoveryHost(t *testing.T) {
	rt := &zzProbeRoundTripper{}
	d := NewDisco(nil, zerolog.Nop())
	host, err := svchost.ForComparison("registry.mycorp.com")
	if err != nil {
		t.Fatalf("hostname: %v", err)
	}
	d.disco.ForceHostServices(host, map[string]interface{}{"modules.v1": "https://modules.attacker.example/"})
	d.httpClient = zzProbeRetryableClient(rt)
	d.proxyHttpClient = zzProbeRetryableClient(rt)

	moduleURL := RegistryURL{
		Host:        "registry.mycorp.com",
		Location:    "https://modules.attacker.example/acme/mod/aws",
		Credentials: HostCredentials{token: zzProbeRegistryToken},
	}
	_, _ = d.DownloadLocation(moduleURL, "1.0.0")

	seen := rt.Seen()
	if zzProbeHasAuth(seen) {
		t.Fatalf("the registry credential was sent to a host named by service discovery (%s)", seen[0].host)
	}
}
