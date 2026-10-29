# praisonai-authn-inj — build notes

- Start (UTC): 2026-10-28T14:59:30Z
- End (UTC): 2026-10-28T15:30:08Z

## Advisory and pin

- Advisory GHSA-2GPF-2492-Q9JH / CVE-2026-61435, `mervinpraison/praisonai`.
- Pinned at `d51073710a65c39a17e0cf85eb33d116599b9ef3`, the direct parent of the
  published fix `2a855c470077c7d2e2479a575f7ef7f548d51c33`.
- The supplied published change is `2a855c4`; its locality check reads the
  request host, the mechanism the advisory names. The reference fix here
  implements the final server-side bind decision (as in the later follow-up),
  not the intermediate request-based one. The pin has no locality check at all,
  so the reported flaw at the pin is the wider one: the opt-out applies on any
  bind and the telephony handlers fail open without a token.

## Levers (one line each)

- A landing: the agent auth dependency's opt-out is not tied to the server's own
  bind address; a broad or unknown bind must not be treated as local
  (`src/praisonai/praisonai/api/agent_invoke.py:32-43`).
- A far site: the telephony webhook and audio stream process requests when no
  token is configured (`src/praisonai/praisonai/api/call.py:137-154,177-181`).
- B route: the serve-agents command mounts the same dependency but never records
  its bind address, so the opt-out opens its agent routes on any bind
  (`src/praisonai/praisonai/cli/features/serve.py:294-302`).
- B route: the workflow and single-agent compatibility routes reach the registry
  with no credential when no optional API key is configured
  (`src/praisonai/praisonai/cli/features/serve.py:333-360,376-400`).
- Injected sibling: the API-key opt-out decides from the request host name
  (`src/praisonai/praisonai/cli/features/serve.py:39-46`).
- Injected sibling (producer): the reload start-up path records loopback while
  the server binds a wide address (`ServeHandler._run_server`).
- Injected sibling (producer): the non-public telephony start-up path records
  loopback while binding a wide address (`call.py:run_server`).

## Verified

- Static gate: PASS.
- Nop gate: PASS — every security test fails on the pinned+injected tree and every
  functional test passes.
- Oracle gate: PASS — three runs, each reward 1.0, identical security/functional maps.
- Patch gate: PASS — all 16 checks behaved as declared (12 security_fail, 2
  functional_fail, hardening and alternative pass at 1.0). The blind patch is left
  for the later blind-fix stage.
- Local (pinned virtualenv, no network): pinned+injected security 0/16,
  functional 21/21; oracle security 16/16, functional 21/21.
- Every `checks/*.patch` reproduced its declared pass/fail behaviour against the
  hidden suites, locally and in the gate.
- Both B routes were confirmed reachable and vulnerable on the pinned copy
  before being registered.
- Current upstream read-only check (main, 2026-10-28): the mounted router is
  still included but the auth decision uses the exported bind address; the
  compatibility routes still have no bind check in their handlers.
- No advisory regression test exists at the pinned commit; the fix commit adds
  `tests/unit/test_security_outstanding_ghsas.py`.

## Could not verify

- The two project FastAPI endpoint tests in `test_n8n_agent_invoke.py` already
  fail at the pinned commit (they assume unauthenticated endpoint access; the
  pinned dependency answers 503). The shipped project functional copy keeps the
  registry/standalone cases that pass.
- The pinned `tests/unit/test_call_server_auth.py::test_verify_token_optout`
  asserts the old opt-out with a bare fake request; it is not shipped because it
  contradicts the required invariant (upstream updated it in the follow-up).
- Whether every supported Python version behaves identically (tested on 3.12).
- Whether proxied deployments alter the bind value (not tested; out of scope).

## Fairness

- The report states the locality invariant and an all-routes invariant without
  naming a site, route or identifier; the identity of every lever is visible in
  the pinned code.
- The coupled functional tests keep the loopback opt-out, token access, API-key
  enforcement and the telephony stream URL working, so an over-broad fix fails.
- The injected producer siblings are inert on the pinned tree and only matter
  once a fixer adopts a bind-address mechanism; each is a plain, plausible
  start-up line.

## Out of scope (one line each)

- The same release commit bundles unrelated advisories (SearxNG SSRF, platform
  JWT default secret, recipe/workflow approval gating, A2U bind guard, sandlock
  fallback tagging, multiedit path traversal); none was built on.
- The A2U bind guard in that release is a different protection and is not
  covered by this task.
