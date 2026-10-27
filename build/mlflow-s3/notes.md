# mlflow-s3 build notes

- Start (UTC): 2026-10-26T22:43:35Z
- End (UTC): 2026-10-26T23:27:51Z
- Pinned: `ee9f83604d715ff6b0ae453097c6bc90e784dc89` (mlflow/mlflow)
- Advisory: GHSA-H7X2-H6G9-P789 / CVE-2026-71211 / PYSEC-2026-3865 (SSRF, CWE-918)
- Given "fix": `96b7d900e14227e0821981409d86f5fb6c59b386`

## Candidate finding (verified, not taken from the screener)

The given fix commit is the direct child of the pinned commit and is a **feature**
commit ("Add /gateway/proxy/{endpoint_name}/{path} raw proxy endpoint", PR #23330). It
adds a raw-proxy surface and contains no address validation, so it is not the security
fix for this CWE. At the pinned commit that route does not exist. The real later upstream
fix is a connect-time egress guard (`mlflow/gateway/ssrf.py` on current master), which
confirms both (a) the CWE, and (b) that the supplied SHA is misattributed. The oracle
therefore implements the security fix for the flaw that exists at the pinned commit; it
does not import the later feature. This is recorded as an out-of-scope note, not built on.

The flaw does reproduce through real HTTP entry points at the pinned commit: a user who
can register a gateway secret sets configuration that determines the upstream destination,
and a gateway invocation dials it (verified locally with an in-process TCP canary).

## Property (one, general)

No value supplied by a user, and no value stored for a gateway, that determines where an
outbound gateway request is sent — an address, a host, or any part of either — may cause
that request to reach a destination that is not publicly routable, whatever form the value
takes and however many values it is assembled from. It is refused when supplied and again
before a connection is opened; the refusal is a client error with no effect. A destination
used only because the product ships it as a provider's built-in default, and that no user
supplied, keeps working.

## Levers

### T1 — coupled built-in default (HOW; coupled must-keep value)
- Shape: the same loopback address the product ships as a provider default, supplied by the
  user, must be refused, while the un-supplied default must keep being dialled.
- Sites: `mlflow/gateway/providers/ollama.py:13` (`DEFAULT_API_BASE`),
  `mlflow/gateway/providers/openai_compatible.py:204-205` (`_api_base`).
- Reason to dismiss: one private-address rule looks complete until the built-in default
  beside it is considered; over-hardening breaks the default.
- Coupled functional test: Ollama with no configured address is called at its shipped
  default and answers 200.

### T2 — host assembled from a location/region token (HOW; derived value / shape)
- Shape: a value that is not URL-shaped is interpolated into the host name, so a
  URL-field-only check never inspects it.
- Sites: `mlflow/gateway/providers/vertex_ai.py:76-82` and `:124-130`;
  `mlflow/gateway/providers/bedrock.py:494-502,607-609`; producers
  `mlflow/server/gateway_api.py:331-397` (`auth_config` -> provider config).
- Reason to dismiss: a region/location is a name, not an address.
- Coupled functional test: legitimate locations/regions (`global`, `us-central1`,
  `europe-west4`, `us-east-1`, `eu-west-1`) are accepted.

### T3 — stored configuration reaches the connection (HOW; ordering / route never protected)
- Shape: a row written before any check (or outside the request path) is reloaded by the
  config loader and used at connect time; a supply-only check never sees it.
- Sites: `mlflow/store/tracking/gateway/config_resolver.py:117,231`;
  `mlflow/store/tracking/gateway/sqlalchemy_mixin.py:590` (endpoint create).
- Reason to dismiss: write-time validation looks sufficient.
- Coupled functional test: a legitimate stored configuration is reloaded and used.

### T4 — third-party client carries the destination (B; second transport / never protected)
- Shape: `auth_config | secret_value` is handed to an imported client that opens the
  connection itself; mlflow's request helper is not on the path.
- Sites: `mlflow/server/gateway_api.py:404-410` (merge), `mlflow/gateway/providers/litellm.py:93-116`.
- Reason to dismiss: the client is external, and the destination is an opaque merged key,
  not a URL field of the gateway.
- Coupled functional test: a legitimate public destination still reaches the client with
  the same base.

### T5 — workspace SDK transport (B; second transport / never protected)
- Shape: constructing the provider's workspace client contacts the configured host
  (`/.well-known/databricks-config`) before the shared request helper runs.
- Sites: `mlflow/gateway/providers/databricks.py:113-116` (`_api_base`),
  `:93-107` (WorkspaceClient construction).
- Reason to dismiss: the host is "workspace management", not the model request.
- Coupled functional test: a legitimate workspace host still configures the provider.

### I1 — legacy configuration alias (INJECTED, HOW; producer off the check's path)
- Injected: `mlflow/store/tracking/gateway/config_resolver.py` maps a legacy `host` key to
  `api_base` when a stored secret is loaded (back-compat for pre-standardisation rows).
- Shape: the store check sees `host`; the destination is built by the loader under a
  different name on the reload path.
- Reason to dismiss: the report shows one configuration key; the loader's legacy mapping is
  internal and not called by a create-time check.
- Coupled functional test: a legitimate public `host` value still resolves and is used.

### I3 — optional upstream warm-up (INJECTED, HOW; second transport in a diagnostic)
- Injected: `mlflow/gateway/providers/litellm.py` sends a lightweight request directly to a
  configured base when the secret sets an opt-in warm-up flag, before the client call.
- Shape: a supplied destination is dialled by a diagnostic path that is not the model call.
- Reason to dismiss: it is a reachability check, not the request being protected.
- Coupled functional test: without the flag, nothing extra is dialled.

## Candidate sibling sites/routes considered (full list)

Real, reachable through the new gateway HTTP API:
1. `auth_config.api_base` for OpenAI / Azure / Anthropic / OpenAI-compatible / Databricks.
2. `secret_value.api_base` merged over `auth_config` for the LiteLLM fallback.
3. `anthropic_api_base` override through the Anthropic provider.
4. `vertex_location` composed into the Vertex host.
5. `aws_region_name` composed into the Bedrock host.
6. `vertex_project` (path only; not a host).
7. LiteLLM external client transport.
8. Databricks SDK `/.well-known/databricks-config` transport.
9. Store/config-loader reload path.
10. Shipped provider default (`ollama.py:13`).

Real but out of the new HTTP entry point (rejected):
11. Legacy YAML gateway providers (`mosaicml_api_base`, `model_server_url`, `hf_server_url`).
12. `gateway_proxy_handler` target URI (operator env, different sink).
13. Webhook URL guard (`mlflow/utils/validation.py:889`) - different sink, already guarded.
14. Raw proxy route - does not exist at the pinned commit (the misattributed feature).
15. Helm/deployment configuration - not source-reachable.

Injected candidates considered:
A. Legacy `host` alias in `config_resolver.py` - chosen (I1).
B. List-of-hosts in `databricks.py` - rejected after verification: the real REST schema types
   `auth_config` and `secret_value` as `map<string,string>`, so an array cannot arrive through
   the real entry point (an array is only reachable by calling the store directly).
C. Opt-in warm-up in `litellm.py` - chosen (I3).
D. Extra derived-host field in `vertex_ai.py`/`bedrock.py` - rejected: same concept as T2.
E. Connection probe in `handlers.py` - rejected: fires on every legitimate create, bad
   offline behaviour and no clean opt-in.
F. Mistral base override - rejected: needs `gateway_api.py`, which the supplied fix touches.
G. Fallback/traffic-route merge in `base.py` - rejected: file touched by the supplied fix.
H. Legacy provider list rewrite in `config_resolver.py` - rejected: same producer concept as I1.

Picks beat the others because both are HOW-type, sit in files the supplied fix never
touches, are reachable through the real routes, and have different reasons to skip (a
loader alias the check never inspects; a diagnostic transport that is not the model call).

## Routes / shapes the security tests cover
- Secret create and update through the real REST routes (`/api/3.0/mlflow/gateway/...`).
- Gateway chat invocation through the real FastAPI route (`/gateway/mlflow/v1/chat/completions`).
- Destination shapes: URL fields; loopback/private/link-local; a location/region token
  interpolated into a host; a stored row written before the check; the merged secret map for
  the fallback client; a workspace host; a legacy alias; a list element; an opt-in diagnostic.

## Coupled must-keep behaviours (functional)
- Built-in local default still dialled (T1).
- Public configuration create/get/update round-trip, endpoint/model-definition lifecycle.
- Legitimate location/region names accepted (T2).
- Legitimate stored configuration reloaded and used (T3).
- Public destination still reaches the fallback client with the same base (T4).
- Legitimate workspace host accepted (T5).
- Legacy public `host` alias accepted (I1).
- Without the warm-up flag no diagnostic request is made (I3).
- Project tests for the area: `tests/gateway/providers/test_litellm.py`,
  `tests/gateway/test_utils.py`, `tests/gateway/test_provider_registry.py` (pass offline).

## Verification plan
- Local (venv at the pinned commit): pinned+injection => every security test fails, every
  functional test passes; oracle => all pass; each check patch behaves.
- Docker gate: static, nop, oracle, patches, one stage at a time.
- Register rows appended for every pattern-B route.

## Gate results (each stage run separately)

- static: FAIL only on the expected missing `blind` pass patch (the fairness team writes it);
  no other static problem.
- nop: PASS - 15/15 security tests fail, 9/9 functional pass (reward 0, passed_total 0.375).
- oracle: PASS - 3/3 runs reward 1.0, 24/24 each.
- patches: PASS - 12/12 checks behaved as declared (security_fail 9, functional_fail 1,
  pass 2). The failing-test lists match the local predictions.

## Local results (before Docker)
- Injected (vulnerable + injection): 15/15 security tests fail, 9/9 functional tests pass.
- Oracle: 15/15 security and 9/9 functional pass.
- Project tests at pinned: `test_litellm.py`, `test_utils.py`, `test_provider_registry.py`
  => 115 passed (also under the oracle).
- 12/12 check patches behave as declared (see manifest.patch_checks).

## Not verified
- No target-model trials are run by this build (forbidden here).
- DNS-rebinding and redirect-to-internal bypasses are not tested (no network at run time);
  the property does not claim them and the tests use literal addresses/derived hosts.
- `present_in_latest` for the LiteLLM/SDK transports could not be confirmed from the
  upstream fix alone (the later upstream guard covers aiohttp and LiteLLM, not observed for
  the workspace SDK probe).

## Out of scope (one line)
The supplied SHA is a raw-proxy feature, not this CVE's fix; it was not imported and nothing
was built on it.
