package functional

import (
	"encoding/base64"
	"net/http"
	"testing"
)

// Legitimate use must keep working: a permitted user reaches a matched
// application, the app-name fallback still resolves, the default policy still
// applies to uncovered hosts, and a matching rule's response additions survive.

var staticApp = appSpec{Name: "myapp", Domain: "app.example.com", Allow: "alice"}

func assertRefused(t *testing.T, status int, header http.Header, body string) {
	t.Helper()

	if status < 400 || status >= 500 {
		t.Fatalf("expected a client error, got %d: %s", status, body)
	}

	if header.Get("Remote-User") != "" {
		t.Fatalf("refusal carried Remote-User=%q", header.Get("Remote-User"))
	}
}

func TestStaticExactAddress(t *testing.T) {
	server := startServer(t, serverOptions{Apps: []appSpec{staticApp}})

	status, header, body := server.auth(t, "traefik", "alice", "app.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")

	status, header, body = server.auth(t, "traefik", "mallory", "app.example.com", "/")
	assertRefused(t, status, header, body)
}

func TestStaticShortNameFallback(t *testing.T) {
	apps := []appSpec{{Name: "myapp", Domain: "other.example.com", Allow: "alice"}}
	server := startServer(t, serverOptions{Apps: apps})

	for _, host := range []string{"myapp.example.com", "myapp.eu.example.com"} {
		status, header, body := server.auth(t, "traefik", "alice", host, "/")
		assertAdmitted(t, status, header, body, "alice")

		status, header, body = server.auth(t, "traefik", "mallory", host, "/")
		assertRefused(t, status, header, body)
	}
}

func TestExactAddressWinsOverShortName(t *testing.T) {
	apps := []appSpec{
		{Name: "target", Domain: "myapp.example.com", Allow: "alice"},
		{Name: "myapp", Domain: "other.example.com", Allow: "bob"},
	}
	server := startServer(t, serverOptions{Apps: apps})

	status, header, body := server.auth(t, "traefik", "alice", "myapp.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")

	// bob is admitted by the short-name rule only; the exact address must win.
	status, header, body = server.auth(t, "traefik", "bob", "myapp.example.com", "/")
	assertRefused(t, status, header, body)
}

func TestUncoveredHostFollowsAllowPolicy(t *testing.T) {
	server := startServer(t, serverOptions{Apps: []appSpec{staticApp}})

	status, header, body := server.auth(t, "traefik", "alice", "unknown.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")
}

func TestUncoveredHostFollowsDenyPolicy(t *testing.T) {
	server := startServer(t, serverOptions{Apps: []appSpec{staticApp}, Policy: "deny"})

	status, header, body := server.auth(t, "traefik", "alice", "unknown.example.com", "/")
	assertRefused(t, status, header, body)
}

func TestMatchingRuleResponseHeaders(t *testing.T) {
	apps := []appSpec{{Name: "myapp", Domain: "app.example.com", Allow: "alice", Headers: []string{"x-foo=bar"}}}
	server := startServer(t, serverOptions{Apps: apps})

	status, header, body := server.auth(t, "traefik", "alice", "app.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")

	if got := header.Get("x-foo"); got != "bar" {
		t.Fatalf("matching rule response header x-foo=%q, want %q", got, "bar")
	}
}

func TestMatchingRuleBasicAuth(t *testing.T) {
	apps := []appSpec{{Name: "myapp", Domain: "app.example.com", Allow: "alice", BasicUser: "svc", BasicPass: "secret"}}
	server := startServer(t, serverOptions{Apps: apps})

	status, header, body := server.auth(t, "traefik", "alice", "app.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")

	want := "Basic " + base64.StdEncoding.EncodeToString([]byte("svc:secret"))

	if got := header.Get("Authorization"); got != want {
		t.Fatalf("matching rule Authorization=%q, want %q", got, want)
	}
}

func TestPermittedUserMixedCaseStatic(t *testing.T) {
	server := startServer(t, serverOptions{Apps: []appSpec{staticApp}})

	status, header, body := server.auth(t, "traefik", "alice", "APP.EXAMPLE.COM", "/")
	assertAdmitted(t, status, header, body, "alice")
}

func dockerLabels() map[string]string {
	return map[string]string{
		"tinyauth.apps.myapp.config.domain":    "app.example.com",
		"tinyauth.apps.myapp.users.allow":      "alice",
		"tinyauth.apps.fallback.config.domain": "other.example.com",
		"tinyauth.apps.fallback.users.allow":   "alice",
	}
}

func TestDockerLabelExactAndShortName(t *testing.T) {
	docker := startFakeDocker(t, dockerLabels())
	server := startServer(t, serverOptions{LabelProvider: "docker", DockerHost: docker})

	status, header, body := server.auth(t, "traefik", "alice", "app.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")

	status, header, body = server.auth(t, "traefik", "mallory", "app.example.com", "/")
	assertRefused(t, status, header, body)

	status, header, body = server.auth(t, "traefik", "alice", "fallback.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")

	status, header, body = server.auth(t, "traefik", "mallory", "fallback.example.com", "/")
	assertRefused(t, status, header, body)
}

func TestDockerLabelPermittedUserMixedCase(t *testing.T) {
	docker := startFakeDocker(t, dockerLabels())
	server := startServer(t, serverOptions{LabelProvider: "docker", DockerHost: docker})

	status, header, body := server.auth(t, "traefik", "alice", "APP.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")
}

func configMapApps() []appSpec {
	return []appSpec{
		{Name: "myapp", Domain: "app.example.com", Allow: "alice"},
		{Name: "fallback", Domain: "other.example.com", Allow: "alice"},
	}
}

func TestConfigMapExactAndShortName(t *testing.T) {
	volume := writeConfigMap(t, []string{"app.example.com", "other.example.com"}, configMapApps()...)
	server := startServer(t, serverOptions{LabelProvider: "configmap", LabelProviderPath: volume})

	status, header, body := server.auth(t, "traefik", "alice", "app.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")

	status, header, body = server.auth(t, "traefik", "mallory", "app.example.com", "/")
	assertRefused(t, status, header, body)

	status, header, body = server.auth(t, "traefik", "alice", "fallback.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")

	status, header, body = server.auth(t, "traefik", "mallory", "fallback.example.com", "/")
	assertRefused(t, status, header, body)
}

func TestConfigMapWithoutDeclaredHosts(t *testing.T) {
	volume := writeConfigMap(t, nil, staticApp)
	server := startServer(t, serverOptions{LabelProvider: "configmap", LabelProviderPath: volume})

	status, header, body := server.auth(t, "traefik", "alice", "app.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")

	status, header, body = server.auth(t, "traefik", "mallory", "app.example.com", "/")
	assertRefused(t, status, header, body)
}

func TestConfigMapPermittedUserMixedCase(t *testing.T) {
	volume := writeConfigMap(t, []string{"app.example.com"}, staticApp)
	server := startServer(t, serverOptions{LabelProvider: "configmap", LabelProviderPath: volume})

	status, header, body := server.auth(t, "traefik", "alice", "APP.example.com", "/")
	assertAdmitted(t, status, header, body, "alice")
}
