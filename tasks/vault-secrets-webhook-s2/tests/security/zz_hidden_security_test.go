// Hidden security suite for vault-secrets-webhook-s2.
//
// Every test drives the webhook's real admission entry point (MutatingWebhook.VaultSecretsMutator,
// the function behind /pods, /secrets, /configmaps and /objects) with ordinary Kubernetes objects
// and local httptest peers, and asserts the object-supplied value never reached a connection the
// webhook itself opens. No product code is used to compute an expected value.
package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

)

// The object-supplied address must not drive the webhook's Vault client, on every route that
// resolves Vault values itself. The service account is named by the object, so an accepted
// address would receive the operator-minted token.
func TestSec_ObjectAddressNotUsedForSecret(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewServer(vaultPeer(spy))
	defer srv.Close()

	mw := newTestWebhook(t)
	_, err := mw.VaultSecretsMutator(context.Background(), review(),
		secretObject(objectAnnotations(srv.URL, "test-sa", nil)))
	mustRefuse(t, err, spy, "secret")
}

func TestSec_ObjectAddressNotUsedForConfigMap(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewServer(vaultPeer(spy))
	defer srv.Close()

	mw := newTestWebhook(t)
	_, err := mw.VaultSecretsMutator(context.Background(), review(),
		configMapObject(objectAnnotations(srv.URL, "test-sa", nil)))
	mustRefuse(t, err, spy, "configmap")
}

func TestSec_ObjectAddressNotUsedForObject(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewServer(vaultPeer(spy))
	defer srv.Close()

	mw := newTestWebhook(t)
	_, err := mw.VaultSecretsMutator(context.Background(), review(),
		unstructuredObject(objectAnnotations(srv.URL, "test-sa", nil)))
	mustRefuse(t, err, spy, "object")
}

// Address forms that a host-only comparison would let through must not reach the peer either.
func TestSec_ObjectAddressShapesNotUsed(t *testing.T) {
	forms := map[string]string{
		"userinfo-bearing": "http://user:secret@%s/",
		"query-string":     "http://%s/?x=1",
		"fragment":         "http://%s/#frag",
	}
	for name, form := range forms {
		t.Run(name, func(t *testing.T) {
			spy := &hitSpy{}
			srv := httptest.NewServer(vaultPeer(spy))
			defer srv.Close()

			addr := fmt.Sprintf(form, strings.TrimPrefix(srv.URL, "http://"))
			mw := newTestWebhook(t)
			_, err := mw.VaultSecretsMutator(context.Background(), review(),
				secretObject(objectAnnotations(addr, "test-sa", nil)))
			mustRefuse(t, err, spy, name)
		})
	}
}

// An object-supplied skip-verify must not make the webhook accept a peer it would otherwise
// reject. The operator-configured address points at a self-signed TLS peer.
func TestSec_ObjectSkipVerifyIgnored(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewTLSServer(vaultPeer(spy))
	defer srv.Close()

	setViper(t, "vault_addr", srv.URL)
	setViper(t, "vault_serviceaccount", "test-sa")
	setViper(t, "vault_skip_verify", false)

	mw := newTestWebhook(t)
	_, err := mw.VaultSecretsMutator(context.Background(), review(),
		secretObject(map[string]string{skipAnnotation: "true", roleAnnotation: "test-role"}))
	mustRefuse(t, err, spy, "object skip-verify")
}

// The registry transport is a second outbound connection. An object-supplied skip-verify must not
// disable its certificate verification either.
func TestSec_RegistrySkipVerifyIgnored(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		spy.record(r)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	host := strings.TrimPrefix(srv.URL, "https://")
	mw := newTestWebhook(t)
	pod := podWithEnv(map[string]string{regSkipAnnot: "true"}, host+"/repo/img:1", nil)
	if _, err := mw.VaultSecretsMutator(context.Background(), review(), pod); err == nil {
		t.Fatalf("registry: expected the image lookup to fail without a trusted certificate")
	}
	mustNotConnect(t, spy, "registry skip-verify")
}

// A Pod that asks for the agent sidecar makes the webhook probe the Vault endpoint itself. That
// probe is another outbound connection using the object-supplied address and verification setting.
func TestSec_PodAgentProbeAddressNotUsed(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewServer(vaultPeer(spy))
	defer srv.Close()

	mw := newTestWebhook(t)
	pod := podWithEnv(map[string]string{
		agentAnnotation: "true",
		addrAnnotation:  srv.URL,
		roleAnnotation:  "test-role",
		saAnnotation:    "test-sa",
	}, "registry.invalid/app:1", []string{"sh"})
	// Whether the mutation itself succeeds or is refused is up to the implementation; the
	// invariant is that the object-supplied peer is never contacted.
	_, _ = mw.VaultSecretsMutator(context.Background(), review(), pod)
	mustNotConnect(t, spy, "pod agent probe address")
}

func TestSec_PodAgentProbeSkipVerifyIgnored(t *testing.T) {
	spy := &hitSpy{}
	srv := httptest.NewTLSServer(vaultPeer(spy))
	defer srv.Close()

	setViper(t, "vault_addr", srv.URL)
	setViper(t, "vault_serviceaccount", "test-sa")
	setViper(t, "vault_skip_verify", false)

	mw := newTestWebhook(t)
	pod := podWithEnv(map[string]string{
		agentAnnotation: "true",
		skipAnnotation:  "true",
		roleAnnotation:  "test-role",
	}, "registry.invalid/app:1", []string{"sh"})
	_, _ = mw.VaultSecretsMutator(context.Background(), review(), pod)
	mustNotConnect(t, spy, "pod agent probe skip-verify")
}
