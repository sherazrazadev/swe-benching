package hcl

import (
	"testing"

	"github.com/rs/zerolog"

	"github.com/infracost/infracost/internal/extclient"
)

// TestFuncZZTFCLoaderNoHostStillLoads: a cloud block without an explicit host
// keeps working against the configured trusted host.
func TestFuncZZTFCLoaderNoHostStillLoads(t *testing.T) {
	counter := zzProbeStartConnCounter(t)
	host := counter.Host()
	blocks := zzProbeBlocks(t, `
terraform {
  cloud {
    organization = "acme"
    workspaces {
      name = "prod"
    }
  }
}
`)

	client := extclient.NewAuthedAPIClient(host, zzProbeSecret)
	loader := &TFCRemoteVariablesLoader{client: client, logger: zerolog.Nop()}
	if _, err := loader.Load(RemoteVarLoaderOptions{Blocks: blocks}); err != nil {
		t.Fatalf("legitimate remote-variable loading was refused: %v", err)
	}
	if counter.Count() == 0 {
		t.Fatal("the trusted host was never contacted; legitimate use no longer works")
	}
}

// TestFuncZZTFCLoaderMatchingHostStillLoads: a cloud block that names the
// configured trusted host keeps working.
func TestFuncZZTFCLoaderMatchingHostStillLoads(t *testing.T) {
	counter := zzProbeStartConnCounter(t)
	host := counter.Host()
	t.Setenv("TERRAFORM_CLOUD_HOST", host)
	blocks := zzProbeBlocks(t, zzProbeCloudBlock(host))

	client := extclient.NewAuthedAPIClient(host, zzProbeSecret)
	loader := &TFCRemoteVariablesLoader{client: client, logger: zerolog.Nop()}
	if _, err := loader.Load(RemoteVarLoaderOptions{Blocks: blocks}); err != nil {
		t.Fatalf("a matching trusted host was refused: %v", err)
	}
	if counter.Count() == 0 {
		t.Fatal("the matching trusted host was never contacted")
	}
}
