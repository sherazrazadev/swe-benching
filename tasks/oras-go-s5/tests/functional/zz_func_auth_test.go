/*
Hidden functional tests: legitimate authentication keeps working.
Run from registry/remote/auth as the package's external test package.
*/

package auth_test

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"oras.land/oras-go/v2/registry/remote/auth"
	"oras.land/oras-go/v2/registry/remote/retry"
)

func funcBasic(user, pass string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+pass))
}

func funcCredential(user, pass string) auth.CredentialFunc {
	return func(ctx context.Context, hostport string) (auth.Credential, error) {
		return auth.Credential{Username: user, Password: pass}, nil
	}
}

// A redirect that stays on the same origin must keep carrying the credential.
func TestFunc_SameOriginRedirectKeepsCredential(t *testing.T) {
	const user, pass = "func-user", "func-password"
	wantAuth := funcBasic(user, pass)

	var mu sync.Mutex
	var targetAuth string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/start":
			if r.Header.Get("Authorization") != wantAuth {
				w.Header().Set("Www-Authenticate", `Basic realm="registry"`)
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			http.Redirect(w, r, "/target", http.StatusTemporaryRedirect)
		case "/target":
			mu.Lock()
			targetAuth = r.Header.Get("Authorization")
			mu.Unlock()
			if r.Header.Get("Authorization") == wantAuth {
				w.WriteHeader(http.StatusOK)
				return
			}
			w.WriteHeader(http.StatusUnauthorized)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer ts.Close()

	client := &auth.Client{Client: retry.NewClient(), Credential: funcCredential(user, pass)}
	req, err := http.NewRequest(http.MethodGet, ts.URL+"/start", nil)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("same-origin redirect failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		t.Fatalf("same-origin redirect did not complete")
	}
	mu.Lock()
	got := targetAuth
	mu.Unlock()
	if got != wantAuth {
		t.Fatalf("same-origin redirect lost the credential")
	}
}

// A token service on a different public host, named by the addressed origin's
// own challenge, must still receive the credential.
func TestFunc_TokenServiceOnOtherHostReceivesCredential(t *testing.T) {
	const user, pass = "func-user", "func-password"
	wantAuth := funcBasic(user, pass)
	const tokenValue = "func-realm-token"

	var mu sync.Mutex
	var realmAuth string
	realm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		realmAuth = r.Header.Get("Authorization")
		mu.Unlock()
		fmt.Fprintf(w, `{"token":%q}`, tokenValue)
	}))
	defer realm.Close()

	registry := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer "+tokenValue {
			w.WriteHeader(http.StatusOK)
			return
		}
		challenge := fmt.Sprintf(`Bearer realm=%q,service="registry",scope="repository:repo:pull"`, realm.URL+"/token")
		w.Header().Set("Www-Authenticate", challenge)
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer registry.Close()

	client := &auth.Client{Credential: funcCredential(user, pass)}
	req, err := http.NewRequest(http.MethodGet, registry.URL+"/v2/repo/manifests/v1", nil)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("bearer exchange through a separate token service failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		t.Fatalf("bearer exchange through a separate token service did not complete")
	}
	mu.Lock()
	got := realmAuth
	mu.Unlock()
	if got != wantAuth {
		t.Fatalf("the registry's own token service did not receive the credential")
	}
}

// A caller-supplied CheckRedirect callback on the underlying HTTP client must
// still be invoked.
func TestFunc_CallerCheckRedirectIsPreserved(t *testing.T) {
	var called atomic.Bool
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/a":
			http.Redirect(w, r, "/b", http.StatusTemporaryRedirect)
		case "/b":
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer ts.Close()

	underlying := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			called.Store(true)
			return nil
		},
	}
	client := &auth.Client{Client: underlying}
	req, err := http.NewRequest(http.MethodGet, ts.URL+"/a", nil)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("redirect failed: %v", err)
	}
	resp.Body.Close()
	if !called.Load() {
		t.Fatalf("caller-provided CheckRedirect callback was not invoked")
	}
}

// Anonymous bearer authentication must still work when no credential is
// configured.
func TestFunc_AnonymousBearerExchangeStillWorks(t *testing.T) {
	const tokenValue = "func-anon-token"
	realm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"token":%q}`, tokenValue)
	}))
	defer realm.Close()

	registry := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer "+tokenValue {
			w.WriteHeader(http.StatusOK)
			return
		}
		challenge := fmt.Sprintf(`Bearer realm=%q,service="registry",scope="repository:repo:pull"`, realm.URL+"/token")
		w.Header().Set("Www-Authenticate", challenge)
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer registry.Close()

	client := &auth.Client{}
	req, err := http.NewRequest(http.MethodGet, registry.URL+"/v2/repo/manifests/v1", nil)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("anonymous bearer exchange failed: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		t.Fatalf("anonymous bearer exchange did not complete")
	}
}
