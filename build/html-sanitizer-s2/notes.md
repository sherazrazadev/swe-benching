# html-sanitizer-s2 build notes

- Start (UTC): 2026-10-28T03:39:31Z
- End (UTC): 2026-10-28T04:02:18Z
- Task: `html-sanitizer-s2` (pattern A+B, injected track), repo `typo3/html-sanitizer`
- Pinned (vulnerable) commit: `988caa31b5fa0dbe17a8331bfa3245898a650d88` (direct parent of the published fix)
- Published fix: `bd1a88d9b5a5f67f1120ec41084e9c1a0675641c` ("Mitigate raw-text bypass with ALLOW_INSECURE_RAW_TEXT")

## Levers (one line each)

1. **T1 (reported, how-type shape):** a browser accepts whitespace between a closing raw-text tag name and its bracket (`</style\t>`), so a parser boundary matched on the exact sequence leaves bytes inert to the sanitizer but live to the browser. Reason to dismiss: "the parser already ends the element at `</style>`". Site: `src/Parser/Tokenizer.php:28-66` (reference fix), writer `src/Serializer/Rules.php:152-165`.
2. **T2 (reported, how-type context):** with scripting enabled a browser reads `<noscript>` content as raw text while the sanitizer parses it as ordinary markup, so a nested raw-text element's decoded end tag re-enters markup parsing. Reason to dismiss: "noscript content is ordinary markup". Site: `src/Serializer/Rules.php:202-205` (reference fix).
3. **T3 (real, Pattern B, how-type context):** browsers do not apply raw-text parsing inside `<svg>`/`<math>` foreign content; the serializer emits the sanitizer's inert text unchanged, so it becomes live markup. Reason to dismiss: "svg/math are already special-cased in the serializer" and "an unsupported combination". Site: `src/Serializer/Rules.php:120-150,197-215` — unmodified upstream.
4. **T4 (real, Pattern B, how-type context):** a browser in a `<select>` insertion mode ignores the start tags that would open raw text, so the same inert text becomes ordinary markup there. Reason to dismiss: "invalid nesting; the parser drops it anyway". Site: `src/Serializer/Rules.php:197-215` — unmodified upstream.
5. **T5 (injected, how-type producer/parser mismatch):** an injected local raw-text list in the serializer treats an element the parser reads with character references decoded (`xmp`, escapable raw text upstream) as raw at output time, so a decoded closing tag is echoed as markup. Reason to dismiss: "it is just another legacy text element and it is in the serializer's list". Site: `src/Serializer/Rules.php:211-219`.
6. **T6 (injected, far entry point):** a complete-document input takes a separate whole-document parse path; a fix that only covers fragment parsing leaves that path on the original tokenizer. Reason to dismiss: "sanitization is fragment-only; the fragment parse is the only path that matters". Site: `src/Sanitizer.php:95-113`; the published fix's `parse()` override (`src/Parser/Html5.php:30-47`) is the far site that had no in-package caller.

Coupled must-keep-working next to the sink (functional): elements the configuration opts into unencoded output must still be returned unencoded when legitimate — the JSON-LD `<script>` feature, ordinary inline raw content, and complete-document body extraction. A fix that encodes all raw output (`func_fail_overbroad.patch`) breaks these and scores 0.

## General property (stated once, in `instruction.md`)

"Sanitized output must re-parse in a browser to the same elements and attributes the sanitizer kept. Any text the sanitizer treats as inert — including content inside an element the configuration returns without encoding — must never become a live element or attribute when a browser parses the returned string. This holds for any input, for any element, and for such an element in any position in the output."

Every route and sibling falls under it as written. The instruction names no route, element, context, file, class, function or role; the trigger is one concrete user-level example.

## Sites, routes, input shapes

- **Sites:** `src/Serializer/Rules.php` (raw-text admission and writers), `src/Sanitizer.php` (parse dispatch and parser factory), `src/Parser/Tokenizer.php`, `src/Parser/Html5.php`, `src/Behavior/Tag.php` (public opt-in flag that must keep working).
- **Routes:** fragment whitespace delimiter; noscript nesting; svg foreign content; math foreign content; select context; entity-decoded legacy element; complete-document input.
- **Shapes:** tab/space/newline before `>`; nested raw-text pairs; entity-encoded closing tag; document skeleton with `<!DOCTYPE html>`.

## Injected sibling candidate list (all considered before choosing)

A. Whitespace delimiter variants — reported; kept (T1). Not counted as injected.
B. noscript nested raw text — reported; kept (T2). Not counted as injected.
C. svg/math foreign content — **real upstream; picked (T3).**
D. select insertion mode — **real upstream; picked (T4).**
E. xmp treated as raw at output while parsed as escapable raw text — **injected; picked (T5).**
F. complete-document parse path — **injected; picked (T6).**
G. Public `Serializer\Rules::create()`/`traverse()` on a caller-built DOM (screener O8 route 2). **Dropped:** the caller owns parsing; requiring the serializer to re-sanitize a foreign DOM is arguable, and the task entry point is `sanitize()`. Noted as out of scope, not built on.
H. `AsTextHandler` / `CommonVisitor::convertToText()` `saveHTML()` route (screener O8b #3). **Dropped after analysis:** parser-produced raw-text elements contain only text nodes, and handlers cannot place serialized elements inside them, so no live route through `sanitize()` could be constructed that a correct fix would not already cover.
I. `<noscript>` element itself as raw text (self-context; the ancestor guard does not cover the node itself). **Dropped:** needs the same injected entity-decoding mechanism as T5 and would duplicate it; also an odd opt-in for an application.
J. A broader injected raw list (`title`, `textarea`, `plaintext`). **Dropped:** title/textarea are escapable raw text in the browser too, and plaintext keeps everything as text; neither yields live markup.
K. table/template/caption contexts. **Dropped:** the browser applies the in-head rules there, so style content is raw text in the browser as well.
L. Second document path that instantiates the vendor parser directly. **Dropped:** same mechanism as T6, less plausible than routing through the configured parser.
M. `Behavior::getTag()` prefix/namespace aliasing. **Dropped:** the default parser configuration disables HTML namespaces, so node names are unprefixed and the alias has no effect.
N. CDATA sections and comments as alternate output. **Dropped:** the vendor writer emits them via `saveXML()`, which cannot produce a live element.
O. `srcdoc`/`style` attributes and `<script>` data-state escaping (`<!--`, `<script`). **Out of scope:** a different sink/parser differential from this advisory; not built on.

Why C–F beat the others: T3/T4 are how-type context gaps in unmodified upstream code that the published fix never touches, and are reachable through the same entry point; T5 is a how-type parser/output mismatch in maintainer-plausible injected code; T6 is the published fix's own far site (whole-document parsing) made reachable through the real entry point, with the strong "fragments are the only path" dismissal. Each has a different reason a solver would skip it.

## What was verified

- The flaw reproduces through the real entry point at the pinned+injected commit for every tested route: the returned string contains a literal `<img ... onerror=...>` that a browser parses as live markup.
- The published fix alone closes T1/T2 and, through its whole-document `parse()` override, T6; it leaves T3/T4/T5 open (verified by applying the published source changes to the injected tree and re-running the same probes). T6 remains a lever because a fix that extends only fragment parsing leaves the document path on the original tokenizer (`sec_fail_document.patch`).
- Reference oracle (published fix + foreign/select context checks + the injected xmp/raw-list correction; document path covered by the published `parse()` override) passes 15/15 security and 10/10 functional locally and in the gate.
- Injected baseline fails all 15 security tests and passes all 10 functional tests.
- `pass_alternative.patch` is a genuinely different design: a serializer-only fix (no tokenizer substitution) that decides from browser context plus the content's own end-tag sequences; it passes 15/15 and 10/10.
- `pass_hardening.patch` (oracle plus end-tag escaping in raw content) passes all tests.
- Every `checks/*.patch` was rehearsed locally against the injected baseline before the gate (outcomes match the manifest).
- The project's own PHPUnit suite (150 tests) passes on the pinned and injected trees and is run during the environment image build.

## What could not be verified

- No real browser is available. Each security payload's browser behaviour was derived from the HTML parsing specification (raw-text delimitation, noscript with scripting, foreign content, select insertion mode, PLAINTEXT); the tests assert the returned string carries no literal attacker tag opener, which is exactly the condition under which those contexts execute it. A browser-based cross-check was not performed.
- `present_in_latest`: the upstream HEAD available here (`8b5d0be`, one commit after the fix) still has only the noscript ancestor check, so T3/T4 are marked `yes`; whether a later unpublished branch fixed them is unknown.
- The target-model trial outcomes are not part of this build; the gate only proves the task's mechanics.
- The container's artifact transport of the in-workspace `vendor/` tree is assumed (not excluded); the nop stage verifies it end to end.

## Out of scope (one line)

`Serializer\Rules::create()`/`traverse()` on a caller-built DOM and the `saveHTML()` paths in `CommonVisitor`/`AsTextHandler` are a different entry/ownership model; noted, not built on.

## Pattern B register

Two unmodified-upstream uncovered routes: svg/math foreign content and the select insertion mode (rows appended to `build/audit/uncovered-routes.tsv`). T5/T6 are injected, not register rows.

## Gate results

- `static`: PASSED (conformance check also conforming). The only declared-but-absent check is the intentionally unwritten `checks/pass_blind.patch`; `FAIRNESS.md` is left to the post-trial stage.
- `nop`: PASSED — 15/15 security tests fail on the injected vulnerable code; 10/10 functional tests pass.
- `oracle`: PASSED — three runs, reward 1.0 each (15/15 security, 10/10 functional), identical results.
- `patches`: PASSED — all ten declared checks behaved as declared:
  - `sec_fail_whitespace` 6 security failing / 0 functional; `sec_fail_noscript` 3/0; `sec_fail_foreign` 3/0; `sec_fail_select` 2/0; `sec_fail_xmp` 1/0; `sec_fail_document` 1/0;
  - `func_fail_overbroad` 3 functional failing (0 security); `func_fail_crash` 3 functional failing;
  - `pass_hardening` reward 1.0; `pass_alternative` reward 1.0.

The strict-gate remainder is exactly the intentionally unwritten `checks/pass_blind.patch` (blind reviewer) and `FAIRNESS.md` (post-trial); nothing else is outstanding.
