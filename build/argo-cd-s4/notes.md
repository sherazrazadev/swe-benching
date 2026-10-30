# argo-cd-s4 — build notes (build-v1, pattern A, track injected)

Start (UTC): 2026-10-30T17:38:16Z
End (UTC): 2026-10-30T19:03:46Z

Repo: argoproj/argo-cd. Pinned: ba80c9664880306b5c17404ea71af877e9190f94.
Published fix: 1e3ddd0b7250aa23f489956b5fab8c13d0493a9f (source file util/git/creds.go).

Advisory (GHSA-j6cw-g6p4-7hch / CVE-2026-55797): the repo-server copies a repository's SSH
SOCKS5 proxy host and port into a `ProxyCommand` inside the shell-run GIT_SSH_COMMAND. A host
containing a single quote breaks out of the surrounding quotes and runs on the repo-server.
Anyone who can create/update a repository or a stored credential configuration can set the
proxy. The advisory names HTTPS repositories as *not* building this command; the published fix
still validates proxy values at the HTTP(S) credential constructors as defence in depth.

## Property, stated once (as shipped in instruction.md)

A repository proxy setting is untrusted configuration. It may be used only when it is a
well-formed proxy address: a scheme the product supports for that repository, a hostname made only
of letters/digits/dots/hyphens or a valid IP literal, and a numeric port 1..65535. Any other value
must be refused as a client error with no side effect, and no part of it may be interpreted by a
command interpreter or used to configure a network proxy. Applies to every repository and every
way the value arrives, including stored configuration.

Every route and sibling below is covered literally by that sentence; none of them is described in
instruction.md.

## Levers (pattern / shape / where / reason a solver dismisses it)

1. L1 (reported baseline): os_command_injection / proxy hostname with a single quote and command
   substitution or redirection, interpolated inside the single-quoted shell GIT_SSH_COMMAND /
   util/git/creds.go:384 (Environ), :338, :305 NewSSHCreds / the report names this path.
2. L2 (pattern A far site, where-type): proxy value handed to a network client / util/git/client.go:346
   GetRepoHTTPClient -> util/proxy/proxy.go:46 GetCallback / "the advisory is SSH; an HTTP transport
   cannot run a shell, so this is unrelated hardening".
3. L3 (pattern B real route, how-type producer off the check's path): the proxy reaches the SSH shell
   sink through the stored credential-template merge, not the request field the report shows /
   pkg/apis/application/v1alpha1/repository_types.go:211 CopyCredentialsFrom -> :284 GetGitCreds ->
   NewSSHCreds / "the fix sits in the credential constructor, so the merge is already covered" (true
   only when the fix is at the library, not at the API/CLI input).
4. L4 (pattern B real route, how-type producer off the check's path): proxy value handed to subprocess
   network configuration / util/proxy/proxy.go:26 UpsertEnv (called by util/git/client.go:1907,
   util/helm/cmd.go:83, util/kustomize/kustomize.go:398) / "it is only an environment variable; no
   shell parses it".
5. L5 (injected sibling, shell sink): an SSH-repository proxy reachability preflight in
   util/git/git.go:135 TestRepo (called by repo-server TestRepository) builds its own sh command
   with the raw host:port / "it is only a connection check; the clone path is what the report means".
6. L6 (injected sibling, shell sink in another package): the kustomize remote-base git wrapper
   installed on the subprocess PATH exports GIT_SSH_COMMAND with the raw proxy host:port / new
   util/kustomize/proxywrapper.go called from util/kustomize/kustomize.go:404 / "the kustomize
   subprocess is a different feature and the wrapper is already hardened for refs".
7. L7 (shape/coupled, how-type): a plausible validator that filters shell metacharacters, or an
   allowlist that rejects '@', '[' or ']', breaks a legitimate authenticated SOCKS5 proxy, a
   bracketed/full IPv6 literal, socks5h, and the port boundaries 1/65535. Coupled functional tests
   sit next to every security test. MiMo tends to over-harden.

## Sibling candidate list (screener O8/O8b + own search)

Real, unmodified upstream:
- util/git/workaround.go:37-51 go-git SSH SOCKS5 ProxyOptions: no shell, a different transport, not
  testable offline without a SOCKS/SSH peer — recorded, not built.
- util/git/client.go:346-357 GetRepoHTTPClient -> proxy.GetCallback (built, L2).
- util/proxy/proxy.go:26-40 UpsertEnv used by git/helm/kustomize (built, L4).
- util/proxy/proxy.go:43-59 GetCallback (same shared helper as L2).
- util/kustomize/gitwrapper.go:44-54 generated /bin/sh git wrapper (host for the injected L6).
- pkg/apis/application/v1alpha1/types.go:4013-4024 ParseProxyUrl (cluster config; clusters never
  reach the SSH sink; out of scope, not built).
- pkg/apis/application/v1alpha1/repository_types.go:258-259 credential-template merge (built, L3).

Chosen injected siblings and why they beat the others:
- L5 TestRepo preflight: another file, reached through the repository connection-test RPC, plausible
  as a maintainer's connectivity preflight, covered by the property, dismissible as "just a check".
- L6 kustomize wrapper: a generated /bin/sh wrapper (a technique this repo already ships for git and
  helm), second package, reached only when kustomize resolves a remote base, dismissible as a
  different feature. Chosen over workaround.go (not a shell sink, not offline-testable) and over
  ParseProxyUrl (clusters never reach the sink).

## Coupled must-keep-working behaviour

- SSH: authenticated proxy keeps SOCKS5_USER/SOCKS5_PASSWD and a usable connect-proxy command with
  the right host:port; IPv6, socks5h, ports 1 and 65535 remain valid; the private-key file and any
  proxy helper file are removed; a refused proxy leaves no temp file.
- L2: a well-formed HTTP proxy is still returned by the transport's proxy callback.
- L4: a well-formed proxy is still placed into http_proxy/https_proxy/no_proxy; no proxy leaves the
  subprocess environment unchanged.
- L5: the connection test still checks a well-formed proxy.
- L6: a kustomize build with a valid proxy still succeeds and the proxy destination still reaches the
  subprocess environment (git wrapper or environment, either design).

## Gate (all four stages passed; see build/argo-cd-s4/gate_report*.json)
- static PASSED; nop PASSED (0/25 security cases pass, 21/21 functional pass);
  oracle PASSED 3/3 runs (reward 1.0, identical results); patches PASSED 12/12 declared outcomes.

## Verified locally (probe module with a replace to the checkout)

- NewSSHCreds(...).Environ() on the pinned tree emits
  `GIT_SSH_COMMAND=ssh -i /dev/shm/N ... -o ProxyCommand='connect-proxy -S a'$(id>marker)'b:1080 -5 %h %p'`
  and running it through /bin/sh creates the marker.
- A legitimate socks5://user:password@host:1080 emits the inline command plus SOCKS5_USER/PASSWD.
- GetRepoHTTPClient returns the raw `http://evil'$(id>x)':8080` from its transport proxy callback.
- proxy.UpsertEnv puts the same raw value into http_proxy/https_proxy.
- url.Parse accepts the payload shapes used and rejects space/backtick/pipe/braces; only shapes that
  reach the sink on the pinned tree are used.
- kustomize 5.8.x resolves a `file://...//base?ref=main` remote base offline.
- Hidden suites on the pinned+injected tree: 0 security testcases pass (25 fail), all functional
  cases pass. On the oracle tree all pass. Check-patch matrix (security/functional):
  sf-no-ssh F/P, sf-no-http F/P, sf-no-env F/P, sf-no-preflight F/P, sf-no-kustomize F/P,
  sf-ssh-only F/P, sf-crash F/P, functional_fail_refuse_all P/F, functional_fail_overbroad P/F,
  functional_fail_adjacent P/F, pass_hardening P/P, pass_alternative_inline P/P.

## Could not verify / open

- present_in_latest for the register rows: unknown (no read-only upstream look performed).
- Repo size thresholds: not measured.
- The published fix's GitHub App / Azure proxy constructors are not tested directly (they only feed
  net/http token requests and cannot be exercised offline); the shared network-client boundary
  (GetRepoHTTPClient) is tested instead.
- The advisory's `http`/`https` proxy-on-SSH-repository path takes the same shell sink; the scheme
  contract in the instruction restricts SSH proxies to socks5/socks5h, as the published fix does.

## Out of scope noted, not built

- pkg/apis/application/v1alpha1/types.go ParseProxyUrl (Cluster proxy): clusters never reach the
  SSH command sink.
