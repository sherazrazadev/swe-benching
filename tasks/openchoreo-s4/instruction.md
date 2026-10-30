# Automatic builds can be started by callers who never authenticated

OpenChoreo is a developer platform: each component records which git repository its source lives
in, and the control plane serves `POST /api/v1alpha1/autobuild` for the git services that host
those repositories. A delivery to that endpoint is supposed to prove which git service sent it —
the deployment keeps one webhook secret per service (GitHub, GitLab, Bitbucket) in the
control-plane namespace — and only then may the control plane start a build (a workflow run) for
the components that track the pushed repository.

Today that authentication can be skipped, so anyone who can reach the endpoint can start workflow
runs in the cluster. For example, this request carries no credential of any kind:

    POST /api/v1alpha1/autobuild
    X-Event-Key: repo:push
    Content-Type: application/json

    {"push":{"changes":[{"new":{"name":"main","type":"branch"},
      "commits":[{"hash":"abc1234"}]}]},
     "repository":{"links":{"html":{"href":"https://bitbucket.org/acme/checkout"}}}}

It starts a build for every auto-build component whose repository is
`https://bitbucket.org/acme/checkout` and reports those components in its response.

## What must hold

**No build or workflow run may be started for a component as a result of a webhook request unless
that request is authenticated as the git service that hosts the component's source repository,
using the secret configured for that service.**

Authentication must fail closed: if the deployment has no secret configured for a service, no
delivery for that service is authenticated. A delivery authenticated as one git service must not
start builds for components whose source is hosted by a different one. These rules hold no matter
how the workflow run is reached and no matter how the repository location is written.

## Contracts that do not change

- A request that is not authenticated for what it is trying to build is answered with an error
  response, and no build is started for the components it is not entitled to build.
- An accepted delivery starts builds for exactly the components it is entitled to build; builds a
  delivery legitimately starts must not be lost because another part of the same request is
  refused.
- Signature and token formats are part of the webhook contract: GitHub sends
  `X-Hub-Signature-256`, GitLab sends `X-Gitlab-Token`, and Bitbucket Cloud signs the exact
  request body with HMAC-SHA256 and sends the digest in `X-Hub-Signature` as `sha256=<hex>`.
- Everything that works today keeps working exactly as today: deliveries signed with the
  configured secret from any supported service, deployments whose repositories are hosted on
  self-managed git services, the branch a component is configured to build, the auto-build switch,
  and the extra builds that a delivery may start for other components on the same service.

The request above is one example, not the full set. Fix the problem and its close variants; keep
legitimate use working; do not look up the upstream fix; do not special-case the example.
