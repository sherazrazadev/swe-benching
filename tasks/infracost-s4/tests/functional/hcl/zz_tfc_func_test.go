package hcl

import (
	"testing"

	"github.com/rs/zerolog"

	"github.com/infracost/infracost/internal/extclient"
)

// TestFuncZZTFCLoaderNoHostStillLoads: a cloud block without an explicit host
// keeps working against the configured trusted host.
func TestFuncZZTFCLoaderNoHostStillLoads(t *testing.T) {
	rec := zzProbeStartRecorder(t)
	host := rec.Host()
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
	loader := zzProbeNewTFCLoader(t, client, false, zerolog.Nop())
	if _, err := loader.Load(RemoteVarLoaderOptions{Blocks: blocks}); err != nil {
		t.Fatalf("legitimate remote-variable loading was refused: %v", err)
	}
	if !trustedRequested(rec.Requests()) {
		t.Fatal("the configured trusted host no longer receives its credential; legitimate use is broken")
	}
}

// TestFuncZZTFCLoaderMatchingHostStillLoads: a cloud block that names the
// configured trusted host keeps working.
func TestFuncZZTFCLoaderMatchingHostStillLoads(t *testing.T) {
	rec := zzProbeStartRecorder(t)
	host := rec.Host()
	t.Setenv("TERRAFORM_CLOUD_HOST", host)
	blocks := zzProbeBlocks(t, zzProbeCloudBlock(host))

	client := extclient.NewAuthedAPIClient(host, zzProbeSecret)
	loader := zzProbeNewTFCLoader(t, client, true, zerolog.Nop())
	if _, err := loader.Load(RemoteVarLoaderOptions{Blocks: blocks}); err != nil {
		t.Fatalf("a matching trusted host was refused: %v", err)
	}
	if !trustedRequested(rec.Requests()) {
		t.Fatal("the matching trusted host no longer receives its credential")
	}
}
