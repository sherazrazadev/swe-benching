package hcl

import (
	"fmt"
	"testing"

	"github.com/rs/zerolog"

	"github.com/infracost/infracost/internal/extclient"
)

const zzProbeSecret = "zz-probe-tfc-token"

func zzProbeCloudBlock(host string) string {
	return fmt.Sprintf(`
terraform {
  cloud {
    organization = "acme"
    hostname     = %q
    workspaces {
      name = "prod"
    }
  }
}
`, host)
}

func zzProbeRemoteBackendBlock(host string) string {
	return fmt.Sprintf(`
terraform {
  backend "remote" {
    organization = "acme"
    hostname     = %q
    workspaces {
      name = "prod"
    }
  }
}
`, host)
}

// TestSecZZTFCLoaderCloudHost: while loading remote variables for a scanned
// project, the configured Terraform Cloud token must never reach a host named
// inside that project. A request without the credential is acceptable; a
// request carrying it is not.
func TestSecZZTFCLoaderCloudHost(t *testing.T) {
	rec := zzProbeStartRecorder(t)
	blocks := zzProbeBlocks(t, zzProbeCloudBlock(rec.Host()))

	client := extclient.NewAuthedAPIClient("app.terraform.io", zzProbeSecret)
	loader := zzProbeNewTFCLoader(t, client, false, zerolog.Nop())
	_, _ = loader.Load(RemoteVarLoaderOptions{Blocks: blocks})

	if has, host := zzProbeHasAuth(rec.Requests()); has {
		t.Fatalf("the Terraform Cloud token was sent to a host named by the scanned input (%s)", host)
	}
}

// TestSecZZTFCLoaderRemoteBackendHost: the backend "remote" hostname is another
// way the scanned input names a host.
func TestSecZZTFCLoaderRemoteBackendHost(t *testing.T) {
	rec := zzProbeStartRecorder(t)
	blocks := zzProbeBlocks(t, zzProbeRemoteBackendBlock(rec.Host()))

	client := extclient.NewAuthedAPIClient("app.terraform.io", zzProbeSecret)
	loader := zzProbeNewTFCLoader(t, client, false, zerolog.Nop())
	_, _ = loader.Load(RemoteVarLoaderOptions{Blocks: blocks})

	if has, host := zzProbeHasAuth(rec.Requests()); has {
		t.Fatalf("the Terraform Cloud token was sent to a host named by the scanned input (%s)", host)
	}
}

// TestSecZZTFCLoaderMixedHosts: one loader is used for a scanned project that
// names an untrusted host and then for one that names the configured trusted
// host. The untrusted host must not receive the credential, and the legitimate
// use must keep working.
func TestSecZZTFCLoaderMixedHosts(t *testing.T) {
	attacker := zzProbeStartRecorder(t)
	trusted := zzProbeStartRecorder(t)

	client := extclient.NewAuthedAPIClient(trusted.Host(), zzProbeSecret)
	loader := zzProbeNewTFCLoader(t, client, true, zerolog.Nop())

	_, _ = loader.Load(RemoteVarLoaderOptions{Blocks: zzProbeBlocks(t, zzProbeCloudBlock(attacker.Host()))})
	if has, host := zzProbeHasAuth(attacker.Requests()); has {
		t.Fatalf("the Terraform Cloud token was sent to a host named by the scanned input (%s)", host)
	}

	_, _ = loader.Load(RemoteVarLoaderOptions{Blocks: zzProbeBlocks(t, zzProbeCloudBlock(trusted.Host()))})
	if !trustedRequested(trusted.Requests()) {
		t.Fatal("the configured trusted host was not contacted after the untrusted host was refused")
	}
}

func trustedRequested(seen []zzProbeRequest) bool {
	for _, req := range seen {
		if req.auth != "" {
			return true
		}
	}
	return false
}
