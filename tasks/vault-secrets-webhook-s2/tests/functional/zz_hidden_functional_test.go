// Hidden functional suite for vault-secrets-webhook-s2: legitimate behaviour next to the sink.
package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// A Vault address configured by the operator is trusted even when it is a loopback address, and
// the mutation completes normally.
func TestFunc_OperatorAddressTrusted(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewServer(vaultPeer(spy))
	defer srv.Close()

	setViper(t, "vault_addr", srv.URL)
	setViper(t, "vault_serviceaccount", "test-sa")

	mw := newTestWebhook(t)
	sec := secretObject(nil)
	if _, err := mw.VaultSecretsMutator(context.Background(), review(), sec); err != nil {
		t.Fatalf("operator-configured address was refused: %v", err)
	}
	if got := string(sec.Data["k"]); got != "v" {
		t.Fatalf("secret was not resolved through the operator-configured address: got %q", got)
	}
	if spy.count() == 0 {
		t.Fatalf("the operator-configured address was never used")
	}
}

// The address a Pod asks for is still handed to the workload it mutates, even when it is not the
// operator-configured address.
func TestFunc_PodAddressPropagated(t *testing.T) {
	const podAddr = "https://vault.other.svc:8200"

	mw := newTestWebhook(t)
	pod := podWithEnv(map[string]string{addrAnnotation: podAddr}, "registry.invalid/app:1", []string{"sh"})
	if _, err := mw.VaultSecretsMutator(context.Background(), review(), pod); err != nil {
		t.Fatalf("pod mutation failed: %v", err)
	}
	got, ok := envValue(pod, "app", "VAULT_ADDR")
	if !ok || got != podAddr {
		t.Fatalf("pod VAULT_ADDR = %q (present=%v), want %q", got, ok, podAddr)
	}
}

// The operator's verification setting still applies when no object overrides it.
func TestFunc_OperatorSkipVerifyHonoured(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewTLSServer(vaultPeer(spy))
	defer srv.Close()

	setViper(t, "vault_addr", srv.URL)
	setViper(t, "vault_serviceaccount", "test-sa")
	setViper(t, "vault_skip_verify", true)

	mw := newTestWebhook(t)
	sec := secretObject(nil)
	if _, err := mw.VaultSecretsMutator(context.Background(), review(), sec); err != nil {
		t.Fatalf("operator skip-verify setting was not honoured: %v", err)
	}
	if got := string(sec.Data["k"]); got != "v" {
		t.Fatalf("secret was not resolved: got %q", got)
	}
	if spy.count() == 0 {
		t.Fatalf("the operator-configured TLS peer was never contacted")
	}
}

// The operator's registry verification setting still applies when no object overrides it.
func TestFunc_OperatorRegistrySkipVerifyHonoured(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		spy.record(r)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	host := strings.TrimPrefix(srv.URL, "https://")
	setViper(t, "registry_skip_verify", true)

	mw := newTestWebhook(t)
	pod := podWithEnv(nil, host+"/repo/img:1", nil)
	_, _ = mw.VaultSecretsMutator(context.Background(), review(), pod)
	if spy.count() == 0 {
		t.Fatalf("the operator registry skip-verify setting was not honoured")
	}
}

// A Pod that asks for the agent sidecar is still mutated and its app container is still rewritten.
func TestFunc_PodAgentStillMutates(t *testing.T) {
	mw := newTestWebhook(t)
	pod := podWithEnv(map[string]string{
		agentAnnotation: "true",
		roleAnnotation:  "test-role",
	}, "registry.invalid/app:1", []string{"sh"})
	if _, err := mw.VaultSecretsMutator(context.Background(), review(), pod); err != nil {
		t.Fatalf("pod mutation failed: %v", err)
	}
	got, ok := envValue(pod, "app", "VAULT_ADDR")
	if !ok || got == "" {
		t.Fatalf("mutated pod is missing its Vault address")
	}
	for _, c := range pod.Spec.Containers {
		if c.Name == "app" && len(c.Command) > 0 && c.Command[0] == "/vault/vault-env" {
			return
		}
	}
	t.Fatalf("app container was not rewritten for secret injection")
}
