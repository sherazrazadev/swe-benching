# dompurify-s5 — build notes

- Start (UTC): 2026-10-28T20:33:54Z
- End (UTC): 2026-10-28T21:07:19Z

## Advisory, pinned tree, defect

- GHSA-C2J3-45GR-MQC4 / CVE-2026-66010, `cure53/DOMPurify`. Pinned (pre-fix)
  `0cae5187403132f96a6d357649e4b15633fc210a` (release 3.4.11). Published fix
  `a9ca1e537422319a557a9a2aa61f003b23b4a197` (release 3.4.12).
- Real defect, verified at the pinned commit through the public API: a custom element kept by
  `CUSTOM_ELEMENT_HANDLING.tagNameCheck` is returned as kept from the disallowed-node helper and the
  caller returns that result without running the `afterSanitizeElements` hook. The documented
  element-hook lifecycle is skipped for exactly the elements the configuration keeps, so an
  application policy applied in that hook is silently not applied. Reproduced through `sanitize()`
  as string, `IN_PLACE`, `RETURN_DOM_FRAGMENT`, stored configuration, template content and an
  attached shadow root.
- The published 3.4.12 commit bundles many unrelated protections (declarative partial updates,
  IN_PLACE neutralisation, hook-detach handling, two SVG presentation attributes). Only the advisory
  hunk was used for the oracle; nothing else was built on. One line, outside this advisory's scope.

## Property (stated once, in instruction.md)

Every element the sanitizer does not remove must have been passed to the application's element hook
before the call returns; an element the sanitizer removes must not be passed to it; and the hook's
effect (a dropped element, a removed attribute) is part of the property. Read literally it covers
every keep path, every input form, and elements processed in the result, wherever they sit.

## Levers (one line each)

- T1 (pattern A, real): kept custom element returns before the element hook. Reason to dismiss: the
  pinned code's own comment calls the skip intentional. `src/purify.ts:1677` (keep) /
  `src/purify.ts:1775` (caller return; pinned 1787).
- T2 (pattern B/injected, HOW): the shadow-tree walk reuses the shared keep predicate and skips the
  element pass for configured custom elements, so template content and attached shadow roots never
  run the keep decision or the hook. Reason to dismiss: a separate walk that reads as needing only
  attribute sanitisation. `src/purify.ts:2207-2215`.
- T3 (pattern B/injected): a tag approved by the caller's `ADD_TAGS` predicate is kept early, before
  the shared element tail, so the element hook never runs for it. Reason to dismiss: it reads as a
  different feature (predicate allow), not custom-element handling. `src/purify.ts:1778-1786`.
- T4 (coupled must-keep-working): running the hook for every node leaving the disallowed branch also
  fires it on nodes the sanitizer removed; `ff-overbroad.patch` fails the functional scope checks.
  The hook must run once per survivor and only for survivors.

## Candidate sibling sites and routes (full list) and why the picks won

1. A third keep branch in `_sanitizeDisallowedNode` (new `CUSTOM_ELEMENT_HANDLING` option, or a
   generic `if (isCustom) return false`) — rejected: same function as the reported site, a new
   option is a feature rather than a plausible leftover, and the caller-level reported fix covers
   every false return from that helper.
2. A keep/skip decision inside `_sanitizeShadowDOM` (screener O8b #2) — PICKED as T2. It is the only
   second *sink*: the main element pass is not on its path, so no caller-level fix reaches it. Far
   from the report, reachable through real entry points (template content, attached shadow roots),
   and plausible as an optimisation that reuses the shared predicate.
3. The `_sanitizeAttachedShadowRoots` pre-pass skipping roots hosted by kept custom elements —
   rejected: it skips attribute sanitisation too, a total bypass rather than a hook-lifecycle gap,
   and it overlaps T2's sink.
4. An early return in `_sanitizeAttributes`/`_isValidAttribute` for custom-element attributes that
   skips the attribute hooks (screener O8b #3) — rejected: a different protection (attribute-hook
   lifecycle) needing a second property; the element property must not be stretched to cover it.
5. A generic `if (isCustomElement) return false` fast path in `_sanitizeElements` — rejected: it
   would intercept the reported case, so the published fix would no longer reproduce or fix the
   reported symptom; it masks the advisory instead of adding a sibling.
6. An early keep for `ADD_TAGS` predicate-approved tags — PICKED as T3. A distinct keep mechanism
   on the public allow path, does not intercept the reported case, is not covered by the reported
   caller-level return, and is findable from the code but unrelated to the report's config.
7. An element-level keep for `is=`/`allowCustomizedBuiltInElements` on non-allowlisted built-ins —
   rejected as not reachable: the built-in tags that can carry `is` and are disallowed are either
   allowlisted (`blink`, `marquee`, …) or already custom elements kept by the reported branch.
8. A keep for spec-reserved hyphenated names (`font-face`, …) — rejected: reserved names are
   excluded from custom elements upstream; a keep would be a new allowlist hole, not the same
   mistake, and needs a new option.
9. An IN_PLACE-root fast path — rejected: an IN_PLACE root must be an allowlisted tag (a
   custom-element root throws at preflight), so the route does not exist.
10. A skip for KEEP_CONTENT-hoisted children — rejected: moved/cloned children are re-visited by the
    iterator (verified behaviourally), so there is no gap.
11. Re-entrant sanitize / removal-inventory handling — rejected: that is the separate hook-detach
    advisory (GHSA-p98j) already built as `stk-dompurify-ghsap98j`; out of scope here.

Why the picks beat the others: T2 is the only second sink and is how-type — its fix needs the
second walk understood, not just found, and it is invisible to every fix placed in the reported
helper. T3 is a second keep mechanism orthogonal to the reported configuration and is bypassed by a
direct return, so it survives a fix that only adds the hook at the reported return. They have
different reasons to dismiss (a separate walk vs a different configuration feature), both are
reachable through the real entry point, and both fall under the property as written.

## Verified locally (node 22 tree; the gate uses node 20)

- Pinned + injected tree: 12/12 security cases fail (each asserted attack blocked), 945/945
  functional cases pass (12 task cases + 933 staged project testcases / 1155 assertions).
- Reference fix (published advisory hunk + both sibling fixes): 12/12 security pass, 945/945
  functional pass.
- `sf-miss-reported.patch`: 9 security cases fail (reported + shadow), functional clean.
- `sf-miss-shadow.patch`: 3 security cases fail (template content ×2, attached shadow root),
  functional clean.
- `sf-miss-addtags.patch`: 3 security cases fail (predicate route ×3), functional clean.
- `sf-regexp-only.patch`: 1 security case fails (function-predicate form), functional clean.
- `ff-overbroad.patch` / `ff-remove-custom.patch`: functional failures as declared (see gate).
- `pass-hardening.patch` / `pass-alternative.patch`: reward 1.0 as declared (see gate).
- Project's own pinned QUnit suite: 1155/1155 assertions pass on the injected tree and on the fix.

## Could not verify

- Upstream status of the injected siblings: they are our code, not upstream (`real_upstream=no` in
  the register).
- Whether the two target models actually fail: the builder does not run trials.
- Node 20 vs node 22 for the image build: the gate builds and runs it; the same repository at the
  same pinned commit is already built on node 20 by `stk-dompurify-ghsap98j`.

## Fairness notes

- The report never names a file, function, hook entry point, option, route or sibling. It states the
  property once over surviving elements and the coupled contracts (survivors only, once each,
  preserved behaviour).
- Both siblings are reachable from the public entry point and are covered by the property read
  literally; a blind engineer who tests the sanitizer's own walked regions (template content,
  attached shadow roots) and its other documented allow mechanism finds them.
- The coupled checks punish the tempting over-broad hook call and the remove-the-feature fix.

## Out of scope (one line)

The 3.4.12 release commit bundles unrelated declarative-partial-update, IN_PLACE teardown, hook-detach
and SVG-attribute protections; none of them was built on or assessed.

## Gate results (2026-10-28, run on the shared VM)

- static: PASSED (no warnings; the separately wired kind=blind patch and FAIRNESS.md remain downstream).
- nop: PASSED - 12/12 security cases fail on the pinned+injected tree, 945/945 functional cases pass.
- oracle: PASSED - 3/3 runs reward 1.0, identical security/functional maps (12/12 and 945/945 each).
- patches: PASSED - 8/8 declared outcomes, each matching the local pre-check: sf-miss-reported
  (9 security failures, 0 functional), sf-miss-shadow (3/0), sf-miss-addtags (3/0),
  sf-regexp-only (1/0), ff-overbroad (0 security failures, 1 functional), ff-remove-custom
  (9/4), pass-hardening (1.0), pass-alternative (1.0).
- Trials: not run by the builder (per the build prompt).
