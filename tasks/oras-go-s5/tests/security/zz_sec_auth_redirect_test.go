/*
Hidden security tests: the registry credential must not reach a foreign origin.
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
	"testing"

	"oras.land/oras-go/v2/registry/remote/auth"
	"oras.land/oras-go/v2/registry/remote/retry"
)

func secBasic(user, pass string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+pass))
}

func secCredential(user, pass string) auth.CredentialFunc {
	return func(ctx context.Context, hostport string) (auth.Credential, error) {
		return auth.Credential{Username: user, Password: pass}, nil
	}
}

// An authenticated request that is redirected to another port on the same host
// must not carry the registry credential there.
func TestSec_AuthenticatedRedirectDoesNotForwardCredential(t *testing.T) {
	const user, pass = "sec-user", "sec-password"
	wantAuth := secBasic(user, pass)

	var mu sync.Mutex
	var sinkAuth string
	sink := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		sinkAuth = r.Header.Get("Authorization")
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer sink.Close()

	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != wantAuth {
			w.Header().Set("Www-Authenticate", `Basic realm="registry"`)
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		http.Redirect(w, r, sink.URL+r.URL.RequestURI(), http.StatusTemporaryRedirect)
	}))
	defer origin.Close()

	client := &auth.Client{
		Client:     retry.NewClient(),
		Credential: secCredential(user, pass),
	}
	req, err := http.NewRequest(http.MethodGet, origin.URL+"/v2/library/example/blobs/sha256:0", nil)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	resp, err := client.Do(req)
	if err == nil {
		resp.Body.Close()
	}
	mu.Lock()
	got := sinkAuth
	mu.Unlock()
	if got != "" {
		t.Fatalf("registry credential was forwarded to another origin")
	}
}

// A token already cached for the registry must not be forwarded when a later
// request is redirected to another origin.
func TestSec_CachedTokenRedirectDoesNotForwardCredential(t *testing.T) {
	const user, pass = "sec-user", "sec-password"
	const tokenValue = "sec-cached-token"

	var mu sync.Mutex
	var sinkAuth string
	tokenServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"token":%q}`, tokenValue)
	}))
	defer tokenServer.Close()

	sink := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		sinkAuth = r.Header.Get("Authorization")
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer sink.Close()

	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v2/repo/manifests/v1":
			if r.Header.Get("Authorization") == "Bearer "+tokenValue {
				w.WriteHeader(http.StatusOK)
				return
			}
			challenge := fmt.Sprintf(`Bearer realm=%q,service="registry",scope="repository:repo:pull"`, tokenServer.URL+"/token")
			w.Header().Set("Www-Authenticate", challenge)
			w.WriteHeader(http.StatusUnauthorized)
		case "/redirect":
			if r.Header.Get("Authorization") == "Bearer "+tokenValue {
				http.Redirect(w, r, sink.URL+"/catch", http.StatusTemporaryRedirect)
				return
			}
			w.WriteHeader(http.StatusUnauthorized)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer origin.Close()

	client := &auth.Client{
		Client:     retry.NewClient(),
		Cache:      auth.NewCache(),
		Credential: secCredential(user, pass),
	}

	ctx := auth.WithScopes(context.Background(), "repository:repo:pull")

	// First exchange obtains and caches the token.
	first, err := http.NewRequestWithContext(ctx, http.MethodGet, origin.URL+"/v2/repo/manifests/v1", nil)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	resp, err := client.Do(first)
	if err != nil {
		t.Fatalf("first exchange failed: %v", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		resp.Body.Close()
		t.Fatalf("first exchange did not succeed")
	}
	resp.Body.Close()

	// Second exchange uses the cached token and is redirected away.
	second, err := http.NewRequestWithContext(ctx, http.MethodGet, origin.URL+"/redirect", nil)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	resp2, err2 := client.Do(second)
	if err2 == nil {
		resp2.Body.Close()
	}
	mu.Lock()
	gotSink := sinkAuth
	mu.Unlock()
	if gotSink != "" {
		t.Fatalf("cached credential was forwarded to another origin")
	}
}

// A redirect before authentication whose target answers with a bearer challenge
// naming a realm on yet another origin must not make the client send the
// registry credential to that realm, nor to the redirect target.
func TestSec_PreAuthRedirectChallengeDoesNotLeakCredential(t *testing.T) {
	const user, pass = "sec-user", "sec-password"

	var mu sync.Mutex
	var realmAuth, sinkAuth string
	realm := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		realmAuth = r.Header.Get("Authorization")
		mu.Unlock()
		fmt.Fprint(w, `{"token":"sec-realm-token"}`)
	}))
	defer realm.Close()

	sink := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		sinkAuth = r.Header.Get("Authorization")
		mu.Unlock()
		challenge := fmt.Sprintf(`Bearer realm=%q,service="registry",scope="repository:repo:pull"`, realm.URL+"/token")
		w.Header().Set("Www-Authenticate", challenge)
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer sink.Close()

	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, sink.URL+r.URL.RequestURI(), http.StatusTemporaryRedirect)
	}))
	defer origin.Close()

	client := &auth.Client{Credential: secCredential(user, pass)}
	req, err := http.NewRequest(http.MethodGet, origin.URL+"/v2/repo/manifests/v1", nil)
	if err != nil {
		t.Fatalf("building request: %v", err)
	}
	resp, err := client.Do(req)
	if err == nil {
		resp.Body.Close()
	}
	mu.Lock()
	gotRealm, gotSink := realmAuth, sinkAuth
	mu.Unlock()
	if gotRealm != "" {
		t.Fatalf("redirect target's challenge caused the credential to be sent to a token service it named")
	}
	if gotSink != "" {
		t.Fatalf("credential was forwarded to the redirect target")
	}
}
