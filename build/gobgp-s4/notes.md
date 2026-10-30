# gobgp-s4 — build notes

- Task: `gobgp-s4`, pattern `A`, track `injected`.
- Start (UTC): 2026-10-30T05:12:55Z (from `start_utc.txt`).
- Advisory: GHSA-GJRG-JJR3-56CM / CVE-2026-49837 / GO-2026-5955, osrg/gobgp, CWE-125
  (out-of-bounds read of a length-delimited protocol field in the BGP OPEN capability
  parser: a capability's declared CapLen was not enforced before its value was decoded).
- Pinned vulnerable commit: 2ee365d3b0807d049d518f0dd6a9f4906963636b
  (parent of the published fix). Published fix: f02ca397821f6ca182ef4eb492c3cbc459552d7c.

## Plan (written before building)

### The property (one, general)

No value decoded from an OPEN message may be formed from bytes outside the length
declared for it. A capability's value and every length-delimited field inside it are read
only from the bytes its own declared length covers; a capability whose declared length
cannot hold the value it carries is rejected with an error; for a protocol-fixed-size
value a declared length that is not exactly that size is a violation. Holds for every
capability code, for a whole message and for a single element decoded through the public
API. Violations return an error (never panic). Legitimate multi-capability parameters,
zero-length capabilities, tuple-less graceful restart and unknown capability values keep
working.

### Landing point the report leads to

`pkg/packet/bgp/bgp.go:1227-1243` `OptionParameterCapability.DecodeFromBytes` hands the
whole remaining parameter buffer to `DecodeCapability` (bgp.go:1178), which dispatches to
each capability's `DecodeFromBytes`; five of those (bgp.go:503, 684, 765, 1032, 1116)
re-slice `data[2:]` and check the remaining parameter buffer instead of their CapLen.

### Levers (each with a different reason a solver skips it)

1. BASE — the five published decoder sites (AS4, multiprotocol, graceful restart, FQDN,
   software version). Reported example is the zero-length four-octet-AS capability;
   reason skipped: "the report's impact is the AS capability", so only that decoder is
   fixed (`as4_only.patch`, security_fail).
2. A-FAR — the same decoders reached through the exported per-type `DecodeFromBytes` /
   `DecodeCapability` public API with an unbounded buffer. Reason skipped: "the OPEN
   parser already bounds each capability slice, so the per-type decoders only ever see
   their own slice" — false for library callers and the project's own fuzz harness
   (`wrapper_only.patch`, security_fail). This is the screener's O2 lower-level API and
   the documented tempting wrong fix.
3. SHAPE (how-type) — inner length fields inside a capability value (FQDN host/domain
   length bytes, software-version length byte) can declare a value that exceeds CapLen
   while the remaining parameter buffer is long enough; and a fixed-size value that
   declares *more* bytes than its size (CapLen 5 for the four-octet-AS or multiprotocol
   capability). Reason skipped: "these decoders already perform length checks, so they
   are safe" / "reading the first four bytes inside the declared length is safe, so extra
   bytes are harmless" (`fixed_size_only.patch`, security_fail).
4. SIB (injected, how/where mix) — a typed decoder for capability code 3 (ORF, RFC 5291)
   in a new file `pkg/packet/bgp/capability_orf.go`, wired into `DecodeCapability`, that
   iterates the full remaining buffer and takes each entry's type count from the buffer
   rather than from CapLen. Reason skipped: "gobgp does not negotiate ORF, so it is not
   one of the affected capabilities". Its inner type count makes it a nested-length
   shape, not only a copy (`orf_missing.patch`, security_fail).
5. COUPLED (how-type) — over-hardening next to the sink: one optional parameter legally
   carries several capabilities (the decoder's buffer extends past 2+CapLen), a
   zero-length capability is legal, and a graceful-restart capability may be flags+time
   only. A fix that rejects trailing bytes or CapLen==0 breaks these
   (`over_harden.patch`, functional_fail).

### Sites / routes / shapes the security tests cover

- message level via `bgp.ParseBGPMessage` and `bgp.ParseBGPBody` (the daemon's OPEN path);
- direct calls to each exported capability decoder and to `DecodeCapability`;
- shapes: CapLen 0 / shorter-than-value / longer-than-fixed-size; capability followed by
  another capability and capability last in the parameter; FQDN host-name and domain-name
  lengths and software-version length that exceed CapLen but fit the remaining buffer;
  ORF entry with a type count that exceeds its CapLen.

### Coupled behaviour kept working (functional)

multi-capability parameter (extended nexthop + add-path + LLGR), graceful restart with
CapLen 2, zero-length capabilities (route refresh / enhanced route refresh / Cisco route
refresh / carrying label info), unknown capability value preserved, valid
AS4/MP/FQDN/SV, direct decoders on exact buffers, valid ORF + following capability, and
the project's own `pkg/packet/bgp` tests.

### Full candidate sibling list considered

Screener O8b leads plus an own search of `pkg/packet`:
- S-ORF: new typed capability decoder for code 3 reading the full remainder — **picked**
  (in scope, reachable via the OPEN parser, realistic contribution, nested length,
  different dismissal).
- Typed optional-parameter decoder for a second OPEN parameter type — rejected: gobgp
  has no non-capability optional-parameter type in use, so the added type would be
  unreachable/unused-looking (dead code); it also moves the property from capability
  values to optional parameters, outside this advisory's protection.
- `OptionParameterCapability.DecodeFromBytes` ignores `o.ParamLen` when a caller passes a
  longer buffer (bgp.go:1227-1230) — real upstream, but the real OPEN path always slices
  to ParamLen and bounding it would widen the property to the enclosing parameter; kept
  as an out-of-scope observation, not built.
- BMP information TLV `ParseValue(data)` at bmp.go:720-734 (same declared-length-ignored
  habit one package away) — rejected: BMP is outside the BGP OPEN capability parser this
  advisory covers; noted only.
- Typed capability for code 9 (BGP Role) or code 6 (Extended Message) — rejected as a
  second capability decoder: same concept as S-ORF, would fall together with it.
- `CapExtendedNexthop` (bgp.go:595), `CapAddPath` (854), `CapLongLivedGracefulRestart`
  (968) already bound by CapLen; `CapUnknown` keeps the base-bounded value — no gap.
- UPDATE-path decoders (`AsPathParam`, `As4PathParam`, `EVPNNLRI`, `TunnelEncapSubTLV`)
  bound by their own counters — outside the OPEN parser, no gap.

Why S-ORF beat the others: it is the only candidate that is simultaneously in this
advisory's scope (a capability value), reachable through the real OPEN entry point,
written in the same pre-fix style a maintainer would produce, and structured with an
inner length so a shallow "slice the value" fix must also reason about the entry count.

## Verification log

All local checks ran offline against scratch copies of the pinned tree:

- Pinned+injected tree (`gobgp-inj`): all 22 security checks fail (the attack is accepted) and
  all 12 functional checks pass; `go test ./pkg/packet/bgp ./pkg/packet/bmp ./pkg/packet/mrt`
  passes.
- Oracle tree (published fix + ORF fix): all 22 security and 12 functional checks pass;
  `go test ./pkg/packet/bgp` passes.
- `environment/injection.patch` applied to a fresh clone of the pinned commit reproduces the
  injected tree byte-for-byte, and `solution/fix.patch` then reproduces the oracle tree
  byte-for-byte.
- Wrong-fix patches, each applied to a fresh injected tree and run through the same suites:
  - `as4_only.patch` security_fail (15 security fail, functional pass, project pass)
  - `wrapper_only.patch` security_fail (5 direct-decoder security fail, functional pass, project pass)
  - `fixed_size_only.patch` security_fail (7 shape security fail, functional pass, project pass)
  - `orf_missing.patch` security_fail (3 ORF security fail, functional pass, project pass)
  - `panic_refusal.patch` security_fail (7 AS security fail, functional pass, project pass)
  - `over_harden.patch` functional_fail (4 functional fail, project fail)
  - `refuse_all.patch` functional_fail (11 functional fail)
  - `reject_zero_len.patch` functional_fail (2 functional fail)
  - `hardening.patch` pass (all security, functional and project tests pass)
  - `alt_fix.patch` pass (all security, functional and project tests pass)

## Gate stages

- static: PASSED (2026-10-30T05:28:58Z).
- nop: PASSED (2026-10-30T05:32:40Z): 22 security tests fail on the vulnerable tree, 258
  functional tests pass (12 task functional + 246 project packet tests).
- oracle: PASSED (2026-10-30T05:34:31Z): 3 strict runs, reward 1.0, identical results.
- patches: PASSED (2026-10-30T05:49Z): 10/10 checks behaved as declared - as4_only,
  wrapper_only, fixed_size_only, orf_missing and panic_refusal are security_fail with all
  functional passing; over_harden, refuse_all and reject_zero_len are functional_fail;
  hardening and alt_fix score 1.0.

End (UTC): 2026-10-30T05:49Z.

## Format note

The build prompt's Environment section still says `/app` and "delete `.git`"; the
Frontier-SWE conformance check that `gate.py` enforces supersedes it (BUILDER.md header,
FRONTIER-CONFORMANCE-SPEC). The task uses `/workspace`, a separate verifier image
(`tests/Dockerfile`), uid-1000 `agent`, `network_mode = "no-network"`, and a fresh
one-commit git baseline as the agent. All four gate stages pass in that format.

## What I could not verify

- The advisory record text itself was not fetched; the protection property comes from the
  screener lead and the published fix commit's message and diff.
- No target-model trial was run (forbidden here), so whether DeepSeek V4.1 Flash and
  MiMo-V2.6-Pro fail all 3 finished attempts is unverified.
- `blind.patch` and `FAIRNESS.md` are written later by separate agents; the strict gate's
  blind requirement is declared but not yet exercised.
- The post-trial fairness review has not judged the direct-public-API contract or the
  injected ORF sibling.
- Repo size and Docker build time were only observed on this VM (repo ~33 MB, image build
  a few minutes).

## Fairness notes / out of scope

- The instruction states once that the guarantee covers a single capability decoded through
  the library's public API. This is needed so the direct-decoder security checks are fair;
  it names no function and no location.
- The exact-size clause (a fixed-size value must declare exactly its size) is stated
  explicitly because the published fix enforces it; without it a solver could reasonably
  think reading the first four bytes of a longer declared value is safe.
- The ORF sibling is injected and never named; the property's "every capability code"
  covers it, and the reason to skip it (not negotiated by the project) lives only in the
  code.
- Out of scope, not built on: `pkg/packet/bmp/bmp.go:720-734` passes the unbounded
  remaining buffer to its TLV value parser after checking only `len(data) >= Length`
  (same declared-length-ignored habit, but the BMP parser, not the BGP OPEN capability
  parser); and `OptionParameterCapability.DecodeFromBytes` ignores its own `ParamLen` when
  a caller passes a longer buffer (real upstream, but no message path reaches it because
  the OPEN parser always slices to ParamLen).
