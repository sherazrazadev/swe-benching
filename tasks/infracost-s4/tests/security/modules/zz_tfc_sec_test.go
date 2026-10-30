package modules

import (
	"testing"

	svchost "github.com/hashicorp/terraform-svchost"
	"github.com/rs/zerolog"
)

const zzProbeBaseToken = "zz-probe-base-token"
const zzProbeRegistryToken = "zz-probe-registry-token"

// zzProbeModuleLocation drives the real discovery entry point. The registry's
// service discovery document is forced to point modules.v1 at serviceURL, and
// ModuleLocation returns the credential the product looked up for registryHost.
// The round tripper is installed on the Disco so later versions/download
// requests are observed. Driving ModuleLocation keeps the test independent of
// where a fix records the credential's host.
func zzProbeModuleLocation(t *testing.T, source, registryHost, serviceURL string) (RegistryURL, *Disco, *zzProbeRoundTripper) {
	t.Helper()

	creds := zzProbeHostScopedCredentials(registryHost, zzProbeRegistryToken)
	d := NewDisco(creds, zerolog.Nop())

	host, err := svchost.ForComparison(registryHost)
	if err != nil {
		t.Fatalf("hostname: %v", err)
	}
	d.disco.ForceHostServices(host, map[string]interface{}{"modules.v1": serviceURL})

	moduleURL, ok, err := d.ModuleLocation(source)
	if err != nil {
		t.Fatalf("module location: %v", err)
	}
	if !ok {
		t.Fatalf("module source %q was not recognised as a registry module", source)
	}

	rt := &zzProbeRoundTripper{}
	d.httpClient = zzProbeRetryableClient(rt)
	d.proxyHttpClient = zzProbeRetryableClient(rt)
	return moduleURL, d, rt
}

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

	if hosts := zzProbeAuthHosts(rt.Seen()); len(hosts) > 0 {
		t.Fatalf("the configured Terraform Cloud token was sent to a host named by the module source (%s)", hosts[0])
	}
}

// TestSecZZModuleVersionsDiscoveryHost: credentials looked up for one registry
// must not be attached to a versions request whose host came from the
// registry's service discovery document.
func TestSecZZModuleVersionsDiscoveryHost(t *testing.T) {
	moduleURL, _, rt := zzProbeModuleLocation(t,
		"registry.mycorp.com/acme/mod/aws", "registry.mycorp.com", "https://modules.attacker.example/")

	r := &RegistryLoader{httpClient: zzProbeRetryableClient(rt), logger: zerolog.Nop()}
	_, _ = r.fetchModuleVersions(moduleURL)

	if hosts := zzProbeAuthHosts(rt.Seen()); len(hosts) > 0 {
		t.Fatalf("the registry credential was sent to a host named by service discovery (%s)", hosts[0])
	}
}

// TestSecZZModuleDownloadDiscoveryHost: the same holds for the download URL
// resolved from the service discovery document.
func TestSecZZModuleDownloadDiscoveryHost(t *testing.T) {
	moduleURL, d, rt := zzProbeModuleLocation(t,
		"registry.mycorp.com/acme/mod/aws", "registry.mycorp.com", "https://modules.attacker.example/")

	_, _ = d.DownloadLocation(moduleURL, "1.0.0")

	if hosts := zzProbeAuthHosts(rt.Seen()); len(hosts) > 0 {
		t.Fatalf("the registry credential was sent to a host named by service discovery (%s)", hosts[0])
	}
}
