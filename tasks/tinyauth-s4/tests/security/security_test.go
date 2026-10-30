package security

import "testing"

// Each test drives /api/auth/:proxy through the built server with a signed-in
// user (mallory) whom the application's rule does not admit. A correct product
// must answer with a client error and no identity headers for every spelling of
// the application's address and for every source of the rule.

var staticApp = appSpec{Name: "myapp", Domain: "app.example.com", Allow: "alice"}

func TestStaticMixedCaseHost(t *testing.T) {
	server := startServer(t, serverOptions{Apps: []appSpec{staticApp}})

	status, header, body := server.auth(t, "traefik", "mallory", "APP.example.com", "/")
	assertBlocked(t, status, header, body)
}

func TestStaticExplicitPort(t *testing.T) {
	server := startServer(t, serverOptions{Apps: []appSpec{staticApp}})

	status, header, body := server.auth(t, "traefik", "mallory", "app.example.com:443", "/")
	assertBlocked(t, status, header, body)
}

func TestStaticTrailingDot(t *testing.T) {
	server := startServer(t, serverOptions{Apps: []appSpec{staticApp}})

	status, header, body := server.auth(t, "traefik", "mallory", "App.Example.Com.", "/")
	assertBlocked(t, status, header, body)
}

func TestStaticInternationalisedHost(t *testing.T) {
	apps := []appSpec{{Name: "books", Domain: "xn--bcher-kva.example.com", Allow: "alice"}}
	server := startServer(t, serverOptions{Apps: apps})

	status, header, body := server.auth(t, "traefik", "mallory", "bücher.example.com", "/")
	assertBlocked(t, status, header, body)
}

func TestStaticAppNameFallbackMixedCase(t *testing.T) {
	apps := []appSpec{{Name: "myapp", Domain: "other.example.com", Allow: "alice"}}
	server := startServer(t, serverOptions{Apps: apps})

	status, header, body := server.auth(t, "traefik", "mallory", "MYAPP.example.com", "/")
	assertBlocked(t, status, header, body)
}

func TestStaticAppNameEqualsFirstLabelMixedCase(t *testing.T) {
	apps := []appSpec{{Name: "myapp", Domain: "myapp.example.com", Allow: "alice"}}
	server := startServer(t, serverOptions{Apps: apps})

	status, header, body := server.auth(t, "traefik", "mallory", "MYAPP.example.com", "/")
	assertBlocked(t, status, header, body)
}

func TestStaticMixedCaseViaNginxRoute(t *testing.T) {
	server := startServer(t, serverOptions{Apps: []appSpec{staticApp}})

	status, header, body := server.auth(t, "nginx", "mallory", "APP.example.com", "/")
	assertBlocked(t, status, header, body)
}

func TestStaticMixedCaseViaEnvoyRoute(t *testing.T) {
	server := startServer(t, serverOptions{Apps: []appSpec{staticApp}})

	status, header, body := server.auth(t, "envoy", "mallory", "APP.example.com", "/")
	assertBlocked(t, status, header, body)
}

func dockerLabels() map[string]string {
	return map[string]string{
		"tinyauth.apps.myapp.config.domain":    "app.example.com",
		"tinyauth.apps.myapp.users.allow":      "alice",
		"tinyauth.apps.fallback.config.domain": "other.example.com",
		"tinyauth.apps.fallback.users.allow":   "alice",
	}
}

func TestDockerLabelMixedCaseHost(t *testing.T) {
	docker := startFakeDocker(t, dockerLabels())
	server := startServer(t, serverOptions{LabelProvider: "docker", DockerHost: docker})

	status, header, body := server.auth(t, "traefik", "mallory", "APP.example.com", "/")
	assertBlocked(t, status, header, body)
}

func TestDockerLabelExplicitPort(t *testing.T) {
	docker := startFakeDocker(t, dockerLabels())
	server := startServer(t, serverOptions{LabelProvider: "docker", DockerHost: docker})

	status, header, body := server.auth(t, "traefik", "mallory", "app.example.com:443", "/")
	assertBlocked(t, status, header, body)
}

func TestDockerLabelAppNameFallbackMixedCase(t *testing.T) {
	docker := startFakeDocker(t, dockerLabels())
	server := startServer(t, serverOptions{LabelProvider: "docker", DockerHost: docker})

	status, header, body := server.auth(t, "traefik", "mallory", "FALLBACK.example.com", "/")
	assertBlocked(t, status, header, body)
}

func TestConfigMapMixedCaseHost(t *testing.T) {
	volume := writeConfigMap(t, []string{"app.example.com"}, staticApp)
	server := startServer(t, serverOptions{LabelProvider: "configmap", LabelProviderPath: volume})

	status, header, body := server.auth(t, "traefik", "mallory", "APP.example.com", "/")
	assertBlocked(t, status, header, body)
}

func TestConfigMapPortAndTrailingDot(t *testing.T) {
	volume := writeConfigMap(t, []string{"app.example.com"}, staticApp)
	server := startServer(t, serverOptions{LabelProvider: "configmap", LabelProviderPath: volume})

	status, header, body := server.auth(t, "traefik", "mallory", "App.Example.Com.:443", "/")
	assertBlocked(t, status, header, body)
}

func TestConfigMapDeclaredHostSpelling(t *testing.T) {
	// The mount declares the served host with different capitalisation than the
	// app's configured address. The rule must still come into effect for a
	// request that names the address exactly as the app configures it.
	volume := writeConfigMap(t, []string{"APP.example.com"}, staticApp)
	server := startServer(t, serverOptions{LabelProvider: "configmap", LabelProviderPath: volume})

	status, header, body := server.auth(t, "traefik", "mallory", "app.example.com", "/")
	assertBlocked(t, status, header, body)
}

func TestConfigMapDeclaredHostAndRequestSpelling(t *testing.T) {
	volume := writeConfigMap(t, []string{"APP.example.com"}, staticApp)
	server := startServer(t, serverOptions{LabelProvider: "configmap", LabelProviderPath: volume})

	status, header, body := server.auth(t, "traefik", "mallory", "APP.example.com", "/")
	assertBlocked(t, status, header, body)
}
