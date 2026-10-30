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

// TestSecZZTFCLoaderCloudHost: a host named by the scanned Terraform must not
// receive the configured Terraform Cloud token.
func TestSecZZTFCLoaderCloudHost(t *testing.T) {
	counter := zzProbeStartConnCounter(t)
	blocks := zzProbeBlocks(t, zzProbeCloudBlock(counter.Host()))

	client := extclient.NewAuthedAPIClient("app.terraform.io", zzProbeSecret)
	loader := &TFCRemoteVariablesLoader{client: client, logger: zerolog.Nop()}
	_, _ = loader.Load(RemoteVarLoaderOptions{Blocks: blocks})

	if got := counter.Count(); got != 0 {
		t.Fatalf("the Terraform Cloud token was sent to a host named by the scanned input (%d request(s))", got)
	}
}

// TestSecZZTFCLoaderRemoteBackendHost: the backend "remote" hostname is another
// way the scanned input names a host.
func TestSecZZTFCLoaderRemoteBackendHost(t *testing.T) {
	counter := zzProbeStartConnCounter(t)
	blocks := zzProbeBlocks(t, zzProbeRemoteBackendBlock(counter.Host()))

	client := extclient.NewAuthedAPIClient("app.terraform.io", zzProbeSecret)
	loader := &TFCRemoteVariablesLoader{client: client, logger: zerolog.Nop()}
	_, _ = loader.Load(RemoteVarLoaderOptions{Blocks: blocks})

	if got := counter.Count(); got != 0 {
		t.Fatalf("the Terraform Cloud token was sent to a host named by the scanned input (%d request(s))", got)
	}
}
