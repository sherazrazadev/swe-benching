// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

package webhookcheck

import "testing"

const (
	bitbucketSecret = "bitbucket-webhook-secret"
	gitlabSecret    = "gitlab-webhook-secret"
	githubSecret    = "github-webhook-secret"
)

func allSecrets() map[string]string {
	return map[string]string{
		"bitbucket-secret": bitbucketSecret,
		"gitlab-secret":    gitlabSecret,
		"github-secret":    githubSecret,
	}
}

// A push delivery that carries the Bitbucket event header but no credential must
// not start a build, even when the deployment has a Bitbucket secret configured.
func TestSecForgedBitbucketDeliveryIsRefused(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "checkout", "https://bitbucket.org/acme/checkout.git", "main"),
	)

	body := BitbucketPush("https://bitbucket.org/acme/checkout", "main", "abc1234")
	rec := env.Post(body, BitbucketHeaders(""))

	RequireRefused(t, rec)
	env.RequireNotBuilt("checkout")
}

// With no Bitbucket secret configured at all, an unsigned delivery must not be
// accepted: nothing can authenticate it.
func TestSecUnsignedDeliveryWithoutConfiguredSecretIsRefused(t *testing.T) {
	env := NewEnv(t,
		Secret(map[string]string{"github-secret": githubSecret, "gitlab-secret": gitlabSecret}),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "checkout", "https://bitbucket.org/acme/checkout.git", "main"),
	)

	body := BitbucketPush("https://bitbucket.org/acme/checkout", "main", "abc1234")
	rec := env.Post(body, BitbucketHeaders(""))

	RequireRefused(t, rec)
	env.RequireNotBuilt("checkout")
}

// With no secret configured, a caller can still compute a digest with an empty
// key; that must not authenticate the delivery.
func TestSecDigestWithEmptyKeyDoesNotAuthenticate(t *testing.T) {
	env := NewEnv(t,
		Secret(map[string]string{"github-secret": githubSecret, "gitlab-secret": gitlabSecret}),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "checkout", "https://bitbucket.org/acme/checkout.git", "main"),
	)

	body := BitbucketPush("https://bitbucket.org/acme/checkout", "main", "abc1234")
	rec := env.Post(body, BitbucketHeaders(Signature("", body)))

	RequireRefused(t, rec)
	env.RequireNotBuilt("checkout")
}

// A Bitbucket-authenticated delivery must not build a component whose source is
// hosted on another service, even when the repository is configured in the
// scp-like form.
func TestSecBitbucketDeliveryCannotBuildScpAddressOnAnotherService(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "gateway", "git@github.com:victim/gateway.git", "main"),
	)

	body := BitbucketPush("git@github.com:victim/gateway", "main", "abc1234")
	env.Post(body, BitbucketHeaders(Signature(bitbucketSecret, body)))

	env.RequireNotBuilt("gateway")
}

// The same rule holds when the repository is configured without a scheme.
func TestSecBitbucketDeliveryCannotBuildSchemelessAddressOnAnotherService(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "gateway", "github.com/victim/gateway", "main"),
	)

	body := BitbucketPush("github.com/victim/gateway", "main", "abc1234")
	env.Post(body, BitbucketHeaders(Signature(bitbucketSecret, body)))

	env.RequireNotBuilt("gateway")
}

// A GitLab-authenticated delivery must not build a component hosted elsewhere.
func TestSecGitlabDeliveryCannotBuildComponentOnAnotherService(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "gateway", "https://github.com/victim/gateway", "main"),
	)

	body := GitLabPush("https://github.com/victim/gateway", "main", "abc1234")
	env.Post(body, GitLabHeaders(gitlabSecret))

	env.RequireNotBuilt("gateway")
}

// A component rebuilt alongside a matched component must obey the same rule:
// the authenticated service has to host its source too.
func TestSecRelatedComponentOnAnotherServiceIsNotBuilt(t *testing.T) {
	shared := Component(testNamespace, testProject, "shared", "https://gitlab.com/acme/shared", "main")
	related := WithAnnotation(
		Component(testNamespace, testProject, "report", "https://github.com/victim/report", "main"),
		"openchoreo.dev/build-with", testNamespace+"/shared")

	env := NewEnv(t, Secret(allSecrets()), Workflow(testNamespace, "build"), shared, related)

	body := GitLabPush("https://gitlab.com/acme/shared", "main", "abc1234")
	env.Post(body, GitLabHeaders(gitlabSecret))

	env.RequireBuilt("shared")
	env.RequireNotBuilt("report")
}

// An unsigned delivery in the data-center push shape must not be accepted just
// because that shape is recognised.
func TestSecUnsignedDataCenterDeliveryIsRefused(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "checkout", "https://bitbucket.org/acme/checkout.git", "main"),
	)

	body := BitbucketDataCenterPush("https://bitbucket.org/acme/checkout", "main", "abc1234")
	rec := env.Post(body, BitbucketHeaders(""))

	RequireRefused(t, rec)
	env.RequireNotBuilt("checkout")
}

// A delivery signed with the wrong secret must not be accepted.
func TestSecWrongSecretIsRefused(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "checkout", "https://bitbucket.org/acme/checkout.git", "main"),
	)

	body := BitbucketPush("https://bitbucket.org/acme/checkout", "main", "abc1234")
	rec := env.Post(body, BitbucketHeaders(Signature("not-the-configured-secret", body)))

	RequireRefused(t, rec)
	env.RequireNotBuilt("checkout")
}
