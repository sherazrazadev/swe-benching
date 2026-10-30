# FAIRNESS — cryptography-s4

## 1. Test by test

All tests call the public `verify` entry point and assert only `is_ok()`/`is_err()`, so any internal
layer (matcher, constraint dispatcher, chain builder) and any error kind satisfy them.

| test (file::name) | asserts | covering instruction sentence | could a correct fix fail it? | risk |
|---|---|---|---|---|
| `tests/security/ht_sec.rs::permitted_wildcard_escape` | leaf SAN `*.example.com` rejected when the CA permits only `foo.example.com` (request `bar.example.com`) | "a wildcard is within the permitted scope only if every name in its set is within that scope" | no — requiring the base to be contained is the literal reading | low |
| `…::permitted_wildcard_escape_multilabel` | `*.foo.example.com` rejected under `bar.foo.example.com` for `x.foo.example.com` | same bullet | no | low |
| `…::permitted_wildcard_escape_mixed_case` | same, constraint `FOO.Example.COM` | same bullet + "Names are compared without regard to ASCII letter case" | no | low |
| `…::selfissued_wildcard_permitted_escape` | `*.example.com` rejected when the CA in the path is a self-issued root permitting `foo.example.com` | "when a CA in the path restricts the DNS names it may issue for …" — the self-issued root is a CA in the path | no — the property holds only if the check actually runs; removing the skip rejects | medium |
| `…::selfissued_exact_permitted_escape` | exact `evil.example.com` rejected under a self-issued root permitting `foo.example.com` | standard expert knowledge: RFC 5280 name constraints are inherited by every subordinate SAN, exact or wildcard; also "a CA in it does not authorize the name the certificate is used for" | no — the same skip removal forced by the preceding test rejects this too; only a deliberate exact/wildcard split fails | medium |
| `…::subject_matching_beyond_wildcard_label` | `*.example.com` not accepted for requested `a.b.example.com` | "a certificate must not be accepted as valid for a requested name that is not in the wildcard's set" | no | medium |
| `tests/functional/ht_fun.rs::exact_name_permitted` | exact `foo.example.com` accepted under `example.com` | "Everything that validates today for exact DNS names … keeps validating"; "keep legitimate use working" | no | low |
| `…::exact_name_excluded` | exact `bad.example.com` rejected by excluded `bad.example.com` | standard expert knowledge: an exact name inside an excluded subtree is rejected (RFC 5280) | no | low |
| `…::wildcard_permitted_by_base` | `*.example.com` accepted under permitted `example.com` | "wildcard names whose entire set is in scope … keeps validating exactly as today" | no | low |
| `…::wildcard_permitted_by_multi_label_base` | `*.foo.example.com` accepted under `example.com` for `a.foo.example.com` | same bullet | no | low |
| `…::wildcard_overlapping_excluded` | `*.example.com` rejected when excluded `bar.example.com` intersects its set | "it is outside the excluded scope whenever any name in its set is excluded" | no | low |
| `…::wildcard_not_overlapping_excluded` | `*.example.com` accepted when only `baz.bar.example.com` is excluded | same clause read as "no name in the set is excluded" + preservation | no | low |
| `…::permitted_subtree_case_insensitive` | `*.example.com` accepted under permitted `EXAMPLE.COM` | "Names are compared without regard to ASCII letter case" | no | low |
| `…::subject_matches_single_wildcard_label` | `*.example.com` accepted for `bar.example.com` | "A wildcard still matches exactly one label when names are compared" | no | low |

## 2. Leniency (quality, non-blocking)

- **T1 (reported):** wrong fix = keep one overlap matcher (`pattern.matches(c) || c.matches(base)`),
  `checks/sf-permitted-containment.patch`. Caught by `permitted_wildcard_escape`, `_multilabel`,
  `_mixed_case` (and `selfissued_wildcard_permitted_escape`).
- **T1/over-refusal:** wrong fix = refuse wildcard SANs, `checks/ff-refuse-all.patch`. Caught by
  `wildcard_permitted_by_base`, `wildcard_permitted_by_multi_label_base`.
- **T2 (self-issued skip):** wrong fix = keep the guard, `checks/sf-selfissued-guard.patch`. Caught by
  `selfissued_wildcard_permitted_escape` and `selfissued_exact_permitted_escape`.
- **T3 (requested-name suffix):** wrong fix = keep `dns_name_covers`, `checks/sf-hostname-matcher.patch`.
  Caught only by `subject_matching_beyond_wildcard_label`; the functional one-label test still passes.
- **T4 (over-broad):** wrong fix = apply the permitted containment rule to excluded too,
  `checks/ff-excluded-containment.patch`. Caught by `wildcard_overlapping_excluded`.
- The catalogue's `n/a` rows (crash, wrong resource, reads-only, etc.) are genuinely inapplicable to a
  pure in-memory path check.

Wrong fixes **no test catches**: case-sensitive requested-name comparison (no mixed-case
requested-name/SAN fixture); "every permitted subtree must contain the wildcard" (no fixture with two
permitted subtrees); only the first SAN checked (no multi-SAN leaf); only the immediate issuer's
constraints enforced (no chain with two constrained CAs); removing the self-issued skip only for
trust anchors, not self-issued intermediates (no such fixture).

## 3. Hints (quality, non-blocking)

- "A wildcard still matches exactly one label when names are compared." — names the comparison
  operation and asserts current behaviour; a solver may trust "still". Delete it; property bullet 1
  already covers the outcome.
- "The example above is one instance, not the full set." and "Fix the problem and its close variants."
  — disclose that several variants exist. Reduce to "Fix the underlying issue."
- "Do not special-case the example." — flags a checkable temptation. Prefer "Apply the fix generally."
- "Everything that validates today for exact DNS names … keeps validating exactly as today." —
  unqualified; a literal reader can preserve the self-issued exact acceptance. Reword to "Keep
  legitimate use working."

## 3a. Surface descriptions — Required: generalize

- "A wildcard still matches exactly one label when names are compared." This is an operation-level
  sentence that exists only to cover the requested-name path. Generalize by stating the property once
  over the protected outcome — already present as "a certificate must not be accepted as valid for a
  requested name that is not in the wildcard's set" — and delete the contract bullet. No other
  sentence points at a route, stage or entry point; the permitted/excluded clauses state the property
  over the outcome and should stay.

## 4. Realism (quality, non-blocking)

- T1 and T4 are real upstream behaviour. T2 is injected but plausible: it reuses the existing
  `cert_is_self_issued` and cites RFC 5280 4.2.1.10, and it is reachable through `verify`. T3 is the
  weakest point: `dns_name_covers` is a hand-rolled duplicate of the shared matcher, authored with the
  classic suffix mistake; plausible as legacy code, mildly contrived as a replacement. Fixtures are
  ordinary DER scenarios; the stubbed `CryptoOps` skips signatures only and does not affect name
  logic. No trap needs flagging as out of scope.

## 5. Verdict

**GATE_A reasoning.** The natural fix following the primary stated mechanism — a wildcard is exactly
its one-label expansion set, permitted requires containment of the base, excluded triggers on any
overlap, the check runs for every CA in the path, and the requested-name match uses exactly one label
— passes all 14 tests; the oracle and blind patches confirm. Every test drives the named entry point
and accepts any error kind, so alternative layers and refusal forms are fine. The one borderline
route is the exact-name self-issued case: it is not literally inside the wildcard-scoped property,
and the "everything that validates today for exact DNS names" contract could be read to bless it.
But the same guard removal that the literally covered self-issued wildcard test forces also rejects
it, and RFC 5280 constraint inheritance makes it standard expert knowledge, so the primary-mechanism
fix passes it without extra work. Not unfair. READY.

**Required: generalize** — the single item in §3a (delete/absorb the "still matches exactly one
label when names are compared" bullet).

**Quality to tighten** — add tests for a mixed-case requested name, two permitted subtrees, a
multi-SAN leaf, two constrained CAs, and a self-issued intermediate; run the crate's `--lib` unit
tests in the verifier (currently only the two integration targets run); neutralize the §3 wording,
including narrowing "everything that validates today for exact DNS names" to legitimate use.

**Human review:** confirm `selfissued_exact_permitted_escape` is fair despite the wildcard-scoped
property and the "everything that validates today for exact DNS names" preservation contract.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
