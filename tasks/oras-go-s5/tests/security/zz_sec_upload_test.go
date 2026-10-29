/*
Hidden security test: a registry-named upload continuation endpoint on another
origin must not receive the registry credential.
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

func uplCredential(user, pass string) auth.CredentialFunc {
	return func(ctx context.Context, hostport string) (auth.Credential, error) {
		return auth.Credential{Username: user, Password: pass}, nil
	}
}

func TestSec_UploadContinuationLocationDoesNotReceiveCredential(t *testing.T) {
	const user, pass = "sec-user", "sec-password"
	wantAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+pass))
	content := []byte("security-test-layer-content")
	desc := ocispec.Descriptor{
		MediaType: ocispec.MediaTypeImageLayer,
		Digest:    digest.FromBytes(content),
		Size:      int64(len(content)),
	}

	var mu sync.Mutex
	var sinkAuth string
	sink := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		sinkAuth = r.Header.Get("Authorization")
		mu.Unlock()
		w.WriteHeader(http.StatusCreated)
	}))
	defer sink.Close()

	var originURL string
	origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v2/repo/blobs/uploads/":
			if r.Header.Get("Authorization") != wantAuth {
				w.Header().Set("Www-Authenticate", `Basic realm="registry"`)
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Location", originURL+"/upload/session")
			w.Header().Set("OCI-Chunk-Min-Length", "1")
			w.WriteHeader(http.StatusAccepted)
		case r.Method == http.MethodPatch && r.URL.Path == "/upload/session":
			if r.Header.Get("Authorization") != wantAuth {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Location", sink.URL+"/finalize")
			w.Header().Set("Range", "0-"+strconv.Itoa(len(content)-1))
			w.WriteHeader(http.StatusAccepted)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer origin.Close()
	originURL = origin.URL

	originParsed, err := url.Parse(origin.URL)
	if err != nil {
		t.Fatalf("parsing origin: %v", err)
	}
	repo := &remote.Repository{
		Client: &auth.Client{
			Client:     retry.NewClient(),
			Credential: uplCredential(user, pass),
		},
		Reference: registry.Reference{Registry: originParsed.Host, Repository: "repo"},
		PlainHTTP: true,
	}
	// An error is an acceptable refusal: what must not happen is the credential
	// reaching the foreign endpoint.
	_ = repo.Push(context.Background(), desc, bytes.NewReader(content))

	mu.Lock()
	got := sinkAuth
	mu.Unlock()
	if got != "" {
		t.Fatalf("registry credential was sent to an upload continuation endpoint on another origin")
	}
}
