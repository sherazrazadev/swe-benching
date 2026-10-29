/*
Hidden functional tests: legitimate blob uploads keep working.
Run from registry/remote as the package's external test package.
*/

package remote_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"sync"
	"testing"

	"github.com/opencontainers/go-digest"
	ocispec "github.com/opencontainers/image-spec/specs-go/v1"
	"oras.land/oras-go/v2/registry"
	"oras.land/oras-go/v2/registry/remote"
	"oras.land/oras-go/v2/registry/remote/auth"
	"oras.land/oras-go/v2/registry/remote/retry"
)

func funcUplCredential(user, pass string) auth.CredentialFunc {
	return func(ctx context.Context, hostport string) (auth.Credential, error) {
		return auth.Credential{Username: user, Password: pass}, nil
	}
}

func funcUplRepo(t *testing.T, serverURL string) *remote.Repository {
	t.Helper()
	u, err := url.Parse(serverURL)
	if err != nil {
		t.Fatalf("parsing server URL: %v", err)
	}
	const user, pass = "func-user", "func-password"
	return &remote.Repository{
		Client: &auth.Client{
			Client:     retry.NewClient(),
			Credential: funcUplCredential(user, pass),
		},
		Reference: registry.Reference{Registry: u.Host, Repository: "repo"},
		PlainHTTP: true,
	}
}

func funcUplWantAuth() string {
	const user, pass = "func-user", "func-password"
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+pass))
}

// A chunked upload whose continuation stays on the registry must complete and
// carry the credential on both the chunk and the final request.
func TestFunc_ChunkedUploadSameOriginCompletes(t *testing.T) {
	wantAuth := funcUplWantAuth()
	content := []byte("functional-chunked-layer-content")
	desc := ocispec.Descriptor{
		MediaType: ocispec.MediaTypeImageLayer,
		Digest:    digest.FromBytes(content),
		Size:      int64(len(content)),
	}

	var mu sync.Mutex
	var patchAuth, putAuth string
	var serverURL string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v2/repo/blobs/uploads/":
			if r.Header.Get("Authorization") != wantAuth {
				w.Header().Set("Www-Authenticate", `Basic realm="registry"`)
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Location", serverURL+"/upload/session")
			w.Header().Set("OCI-Chunk-Min-Length", "1")
			w.WriteHeader(http.StatusAccepted)
		case r.Method == http.MethodPatch && r.URL.Path == "/upload/session":
			mu.Lock()
			patchAuth = r.Header.Get("Authorization")
			mu.Unlock()
			if r.Header.Get("Authorization") != wantAuth {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Location", serverURL+"/upload/session")
			w.Header().Set("Range", "0-"+strconv.Itoa(len(content)-1))
			w.WriteHeader(http.StatusAccepted)
		case r.Method == http.MethodPut && r.URL.Path == "/upload/session":
			mu.Lock()
			putAuth = r.Header.Get("Authorization")
			mu.Unlock()
			if r.Header.Get("Authorization") != wantAuth {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.WriteHeader(http.StatusCreated)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer ts.Close()
	serverURL = ts.URL

	err := funcUplRepo(t, ts.URL).Push(context.Background(), desc, bytes.NewReader(content))
	if err != nil {
		t.Fatalf("same-origin chunked upload failed: %v", err)
	}
	mu.Lock()
	gotPatch, gotPut := patchAuth, putAuth
	mu.Unlock()
	if gotPatch != wantAuth || gotPut != wantAuth {
		t.Fatalf("same-origin chunked upload did not carry the credential on every request")
	}
}

// The conventional monolithic upload must keep working.
func TestFunc_MonolithicUploadStillWorks(t *testing.T) {
	wantAuth := funcUplWantAuth()
	content := []byte("functional-monolithic-layer-content")
	desc := ocispec.Descriptor{
		MediaType: ocispec.MediaTypeImageLayer,
		Digest:    digest.FromBytes(content),
		Size:      int64(len(content)),
	}

	var mu sync.Mutex
	var putAuth string
	var serverURL string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v2/repo/blobs/uploads/":
			if r.Header.Get("Authorization") != wantAuth {
				w.Header().Set("Www-Authenticate", `Basic realm="registry"`)
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Location", serverURL+"/upload/session")
			w.WriteHeader(http.StatusAccepted)
		case r.Method == http.MethodPut && r.URL.Path == "/upload/session":
			mu.Lock()
			putAuth = r.Header.Get("Authorization")
			mu.Unlock()
			if r.Header.Get("Authorization") != wantAuth {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.WriteHeader(http.StatusCreated)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer ts.Close()
	serverURL = ts.URL

	err := funcUplRepo(t, ts.URL).Push(context.Background(), desc, bytes.NewReader(content))
	if err != nil {
		t.Fatalf("monolithic upload failed: %v", err)
	}
	mu.Lock()
	got := putAuth
	mu.Unlock()
	if got != wantAuth {
		t.Fatalf("monolithic upload did not carry the credential")
	}
}
