// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

package webhookcheck

import "testing"

// A genuine GitHub delivery, signed with the configured secret, builds the
// component that tracks the pushed repository.
func TestFuncGithubDeliveryBuildsMatchingComponent(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "checkout", "https://github.com/acme/checkout", "main"),
	)

	body := GitHubPush("https://github.com/acme/checkout", "main", "abc1234")
	rec := env.Post(body, GitHubHeaders(Signature(githubSecret, body)))

	RequireAccepted(t, rec)
	env.RequireBuilt("checkout")
}

// A genuine GitLab delivery, carrying the configured token, builds the
// component that tracks the pushed repository.
func TestFuncGitlabDeliveryBuildsMatchingComponent(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "api", "https://gitlab.com/acme/api", "main"),
	)

	body := GitLabPush("https://gitlab.com/acme/api", "main", "abc1234")
	rec := env.Post(body, GitLabHeaders(gitlabSecret))

	RequireAccepted(t, rec)
	env.RequireBuilt("api")
}

// A genuine Bitbucket delivery, signed with the configured secret, builds the
// component that tracks the pushed repository.
func TestFuncBitbucketSignedDeliveryBuildsMatchingComponent(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "web", "https://bitbucket.org/acme/web.git", "main"),
	)

	body := BitbucketPush("https://bitbucket.org/acme/web", "main", "abc1234")
	rec := env.Post(body, BitbucketHeaders(Signature(bitbucketSecret, body)))

	RequireAccepted(t, rec)
	env.RequireBuilt("web")
}

// A signed Data Center delivery still builds the component.
func TestFuncSignedDataCenterDeliveryBuildsMatchingComponent(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "checkout", "https://bitbucket.org/acme/checkout.git", "main"),
	)

	body := BitbucketDataCenterPush("https://bitbucket.org/acme/checkout", "main", "abc1234")
	rec := env.Post(body, BitbucketHeaders(Signature(bitbucketSecret, body)))

	RequireAccepted(t, rec)
	env.RequireBuilt("checkout")
}

// Deployments also host their source on self-managed services; a signed
// delivery from the configured service must still build those components.
func TestFuncSelfHostedRepositoryStillBuilds(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "internal", "https://git.internal.acme.dev/team/internal.git", "main"),
	)

	body := GitHubPush("https://git.internal.acme.dev/team/internal.git", "main", "abc1234")
	rec := env.Post(body, GitHubHeaders(Signature(githubSecret, body)))

	RequireAccepted(t, rec)
	env.RequireBuilt("internal")
}

// A component configured for one branch is not rebuilt by a push to another.
func TestFuncBranchFilterStillApplies(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "checkout", "https://github.com/acme/checkout", "main"),
	)

	other := GitHubPush("https://github.com/acme/checkout", "feature/new-api", "abc1234")
	rec := env.Post(other, GitHubHeaders(Signature(githubSecret, other)))
	RequireAccepted(t, rec)
	env.RequireNotBuilt("checkout")

	second := GitHubPush("https://github.com/acme/checkout", "main", "def5678")
	rec = env.Post(second, GitHubHeaders(Signature(githubSecret, second)))
	RequireAccepted(t, rec)
	env.RequireBuilt("checkout")
}

// Components that are rebuilt alongside a matched component keep being rebuilt
// when they live on the same service.
func TestFuncRelatedComponentOnSameServiceStillBuilds(t *testing.T) {
	shared := Component(testNamespace, testProject, "shared", "https://gitlab.com/acme/shared", "main")
	related := WithAnnotation(
		Component(testNamespace, testProject, "report", "https://gitlab.com/acme/report", "main"),
		"openchoreo.dev/build-with", testNamespace+"/shared")

	env := NewEnv(t, Secret(allSecrets()), Workflow(testNamespace, "build"), shared, related)

	body := GitLabPush("https://gitlab.com/acme/shared", "main", "abc1234")
	rec := env.Post(body, GitLabHeaders(gitlabSecret))

	RequireAccepted(t, rec)
	env.RequireBuilt("shared")
	env.RequireBuilt("report")
}

// A component that has not opted into automatic builds is never rebuilt by a
// webhook.
func TestFuncAutoBuildDisabledComponentIsNotBuilt(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		NoAutoBuild(Component(testNamespace, testProject, "manual", "https://github.com/acme/manual", "main")),
	)

	body := GitHubPush("https://github.com/acme/manual", "main", "abc1234")
	rec := env.Post(body, GitHubHeaders(Signature(githubSecret, body)))

	RequireAccepted(t, rec)
	env.RequireNotBuilt("manual")
}

// A delivery for a repository no component tracks is answered without starting
// any build.
func TestFuncUnrelatedRepositoryBuildsNothing(t *testing.T) {
	env := NewEnv(t,
		Secret(allSecrets()),
		Workflow(testNamespace, "build"),
		Component(testNamespace, testProject, "checkout", "https://github.com/acme/checkout", "main"),
	)

	body := GitHubPush("https://github.com/acme/other", "main", "abc1234")
	rec := env.Post(body, GitHubHeaders(Signature(githubSecret, body)))

	RequireAccepted(t, rec)
	env.RequireNotBuilt("checkout")
}
