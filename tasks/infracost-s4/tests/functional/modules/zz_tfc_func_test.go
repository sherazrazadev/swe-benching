package modules

import (
	"testing"

	svchost "github.com/hashicorp/terraform-svchost"
	"github.com/rs/zerolog"
)

// TestFuncZZCredentialsSourceHostScoped: credentials stay host-scoped. The
// configured base token is used for its own host and a host-specific
// credential is used for the host it belongs to.
func TestFuncZZCredentialsSourceHostScoped(t *testing.T) {
	creds := &CredentialsSource{
		BaseCredentialSet: BaseCredentialSet{Token: zzProbeBaseToken, Host: "app.terraform.io"},
		FetchToken: func(host string) string {
			if host == "registry.mycorp.com" {
				return zzProbeRegistryToken
			}
			return ""
		},
	}

	baseHost, err := svchost.ForComparison("app.terraform.io")
	if err != nil {
		t.Fatalf("hostname: %v", err)
	}
	c, err := creds.ForHost(baseHost)
	if err != nil {
		t.Fatalf("base host credentials: %v", err)
	}
	if c == nil || c.Token() != zzProbeBaseToken {
		t.Fatalf("the configured host no longer receives its own token")
	}

	privateHost, err := svchost.ForComparison("registry.mycorp.com")
	if err != nil {
		t.Fatalf("hostname: %v", err)
	}
	c, err = creds.ForHost(privateHost)
	if err != nil {
		t.Fatalf("private host credentials: %v", err)
	}
	if c == nil || c.Token() != zzProbeRegistryToken {
		t.Fatalf("a host-specific credential is no longer used for its host")
	}
}

// TestFuncZZModuleLocationHostScopedCredential: a host-scoped registry
// credential is resolved and carried through the real module-location path.
func TestFuncZZModuleLocationHostScopedCredential(t *testing.T) {
	moduleURL, _, _ := zzProbeModuleLocation(t,
		"registry.mycorp.com/acme/mod/aws", "registry.mycorp.com", "https://registry.mycorp.com/")

	if moduleURL.Host != "registry.mycorp.com" {
		t.Fatalf("unexpected module host %q", moduleURL.Host)
	}
	if moduleURL.Credentials == nil || moduleURL.Credentials.Token() != zzProbeRegistryToken {
		t.Fatal("the host-scoped registry credential was not resolved for its host")
	}
}

// TestFuncZZModuleVersionsSameHost: a registry that serves its versions from
// its own host still receives its credential.
func TestFuncZZModuleVersionsSameHost(t *testing.T) {
	moduleURL, _, rt := zzProbeModuleLocation(t,
		"registry.mycorp.com/acme/mod/aws", "registry.mycorp.com", "https://registry.mycorp.com/")

	r := &RegistryLoader{httpClient: zzProbeRetryableClient(rt), logger: zerolog.Nop()}
	versions, err := r.fetchModuleVersions(moduleURL)
	if err != nil {
		t.Fatalf("legitimate registry lookup failed: %v", err)
	}
	if len(versions) != 1 || versions[0] != "1.0.0" {
		t.Fatalf("unexpected versions: %v", versions)
	}
	if !zzProbeHasAuth(rt.Seen()) {
		t.Fatal("the registry credential was not sent to the registry host it belongs to")
	}
}

// TestFuncZZModuleDownloadSameHost: a registry that serves its download from
// its own host still receives its credential.
func TestFuncZZModuleDownloadSameHost(t *testing.T) {
	moduleURL, d, rt := zzProbeModuleLocation(t,
		"registry.mycorp.com/acme/mod/aws", "registry.mycorp.com", "https://registry.mycorp.com/")

	location, err := d.DownloadLocation(moduleURL, "1.0.0")
	if err != nil {
		t.Fatalf("legitimate download lookup failed: %v", err)
	}
	if location == "" {
		t.Fatal("the download lookup returned no location")
	}
	if !zzProbeHasAuth(rt.Seen()) {
		t.Fatal("the registry credential was not sent to the registry host it belongs to")
	}
}
