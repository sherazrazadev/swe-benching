# mistral.rs-mm — build notes

- Start: 2026-10-28T14:59:42Z (driver build run)
- End: 2026-10-28T16:04:06Z
- Advisory: GHSA-WFGQ-W7CQ-QJ7J / entry 21576 (SSRF + local file read via untrusted media source; CWE-918, CWE-73)
- Repo: ericlbuehler/mistral.rs; vulnerable commit 7af17b627a88533d2fe6e192ed8db6c908e5ce5a
  (direct parent of published fix 74793379649febc758b6a0d4b71aa6aeabc80f9c); pattern A, injected track.

## Design (written before the build)

The report leads to the image media source on the chat-completions surface. The published fix makes
the server-side media loaders use a "server request" policy (no local paths/file URLs; resolve DNS and
reject non-global addresses) while the public/in-process loaders keep the "local" policy. The task
tests every entry point the fix protects, the weak pre-existing attachment-URL check, and two injected
sibling gaps.

### Levers (one line each)

1. Pattern A far sites (real upstream): audio and video request media. Reason to dismiss: the report's
   trigger is an image; the video loader lives in its own module and audio is a separate function.
2. Pattern A far site (real upstream): `input_file.file_url` already carries a literal-host check, so
   it looks protected; it is applied before name resolution (and before redirects) and misses
   bracketed IPv6 / IPv4-mapped literals and host names that resolve to loopback.
3. Input shape: a name that resolves to the server itself (rather than a literal address) is covered by
   the general rule and missed by a literal-only fix.
4. Injected sibling S1: a request-supplied server-local path field on the attachment feature
   (`file_path`), added at the attachment resolver. Reason to dismiss: attachments already look
   guarded, and a path is not a URL.
5. Injected sibling S2: an image content object may name a mounted path (`path`) which the parser
   inlines before handing bytes to the media loader. Reason to dismiss: the report and the fix are
   about the URL field; the parser has already normalised the value by the time the loader sees it.
6. Coupled must-keep-working: the public/in-process loaders (used by the CLI and library callers)
   must keep reading local paths and `file:` URLs; inline `data:`/base64 content must keep working.
   This makes an over-broad fix (removing file support, refusing all media) fail.

### Injected siblings (injected track)

`environment/injection.patch` adds both siblings to this copy only; it is applied at image build after
the pinned checkout. Neither is touched by the published fix (upstream touches only the three media
call sites and the attachment URL fetcher; S1 sits in `resolve_input_file`, S2 in the content-part
parser). Each is reachable through the same request-parsing entry point the tests drive, and each is
covered by the instruction's invariant ("every request content that names a resource ... whatever
field or form carries the name").

### Sites / shapes the security tests cover

- image: literal loopback, host name resolving to loopback, IPv4-mapped IPv6 loopback, bare local
  path, `file:` URL, and the injected `path` field.
- audio: loopback URL, bare local path.
- video: loopback URL, `file:` URL.
- attachment (`file_url`, Responses surface): bracketed IPv6 loopback literal, host name resolving to
  loopback, IPv4-mapped IPv6 loopback, and the injected `file_path` on both surfaces.
- Every network case also asserts the loopback endpoint received no request (no side effect).

### Functional (coupled) coverage

Public image/audio/video loaders keep local bare paths and `file:` URLs; server requests keep inline
`data:` image/audio/video and base64/data-URL attachments; text-only requests still work.

## What I verified (local, pinned tree)

- `nop` tree (pinned + injection): all 15 security tests fail as exploits; all 12 functional tests pass.
- Oracle tree (published source fix + both sibling fixes): all 27 pass.
- `injection.patch` then `solution/fix.patch` applied to a fresh pinned checkout reproduces the oracle
  tree byte-for-byte.
- Every `checks/` patch was applied to the injected tree and run through the same harness:

  | patch | result |
  |---|---|
  | sf-image-only | 4 security fail (audio/video), functional pass |
  | sf-no-input-file-guard | 3 security fail (attachment URL), functional pass |
  | sf-no-file-path | 2 security fail (attachment path), functional pass |
  | sf-no-image-path | 1 security fail (image path field), functional pass |
  | ff-disable-local-loaders | 5 functional fail (local loaders), security pass |
  | ff-refuse-all | 3 functional fail (inline media), security pass |
  | pass-hardening | all pass |
  | alt-fix | all pass |

- The project's own media unit test is network-dependent (fetches rust-lang.org) and cannot run
  offline; its offline portion (local path, `file:` URL, `data:` image/audio) is mirrored by the
  functional suite.

## Docker gate

- `static`: PASS.
- `nop`: PASS — on the injected pinned tree, 15/15 security tests fail as live exploits, 12/12
  functional pass, reward 0.0 (trial `mistral.rs-mm-nop-1793200729`). The verifier rebuilt
  `mistralrs-server-core` + the harness offline in ~39 s and produced JUnit XML for both groups.
- `oracle`: PASS — 3/3 runs (strict), each 15/15 security + 12/12 functional, reward 1.0, identical
  results (trials `mistral.rs-mm-oracle1/2/3-*`).
- `patches`: PASS — 8/8 as declared:
  - sf-image-only: security_fail (4 audio/video tests), functional all pass
  - sf-no-input-file-guard: security_fail (3 attachment-URL tests), functional all pass
  - sf-no-file-path: security_fail (2 attachment-path tests), functional all pass
  - sf-no-image-path: security_fail (1 image-path test), functional all pass
  - ff-disable-local-loaders: functional_fail (5 local-loader tests), security all pass
  - ff-refuse-all: functional_fail (3 inline-media tests), security all pass
  - pass-hardening: pass (reward 1.0)
  - alt-fix: pass (reward 1.0, structurally different request-layer guard)

`blind.patch` is declared in `patch_checks` (kind `blind`) but not written here; it is produced
downstream, as are `FAIRNESS.md` and the target-model trials.




## What I could not verify / unknowns

- The redirect-revalidation gap is real upstream but cannot be isolated offline: the first hop would
  need to resolve to a routable public address, and the verifier has no network. No redirect test.
- Publicly routable http(s) success cannot be exercised offline; covered only as a stated contract.
- Whether the two target models fail is decided by trials downstream, not here.
- The pinned tree's own `test_parse_image_url` needs network; not run in the verifier.

## Out of scope (one line each)

- The Python binding has its own synchronous media loaders; in-process trusted caller, unchanged upstream.
- Byte limits added by the fix are resource limits, not the trust decision; not tested.
