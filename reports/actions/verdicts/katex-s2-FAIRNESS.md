# katex-s2 — pre-trial fairness and leniency review

Reviewed: `instruction.md`, every hidden spec, `solution/fix.patch`, `manifest.json` (traps, checks,
catalogue), `notes.md`, `checks/*.patch`. Gate a is judged against the correct fix that follows the
primary mechanism — own-entry reads/own-key copies at each consumer — as the oracle, `pass-alt` and
`blind.patch` each do (22/22 security, 658/658 functional).

## 1. Test-by-test fairness

Covering sentences (quoted once; cells cite them):

- **G** — "Nothing reachable only through JavaScript's shared object prototype may supply, replace or extend the data the library uses to decide what it renders or permits."
- **O** — "Every such value must come from the caller's own input to the library or from the library's own definitions and built-in defaults."
- **D** — "a definition that exists only on the shared object prototype is not a definition the library may use."
- **T** — "Everything that works today keeps working exactly as today."
- **K** — "Caller-supplied configuration and caller-supplied definitions keep their meaning in whatever form the caller provides them…"
- **R** — "rendering the construct as unsupported and throwing are both valid refusals."

| Test (file::name) | Asserts | Covering sentence | Correct fix could fail? | Risk |
|---|---|---|---|---|
| security/test_settings_options.spec.ts::ignores a trust entry inherited from the shared prototype | `Object.prototype.trust=true`; `\href{javascript:…}` emits no `href/src="javascript:alert(1)"` | G, O | no — own-entry read ignores it; null-proto/own-key copy, Map rebuild also pass | low |
| …::ignores a trust entry inherited from the options object's prototype | `Object.create({trust:true})`; same outcome | O ("the caller's own input") | no — the primary own-entry read ignores the front object's prototype; only a fix that special-cases `Object.prototype` itself fails | medium |
| …::ignores an inherited trust entry for a bare URL command | `Object.prototype.trust`; `\url{javascript:…}` not emitted | G, O | no | low |
| …::ignores an inherited trust entry for an image command | `Object.prototype.trust`; `\includegraphics{javascript:…}` not emitted | G, O | no | low |
| security/test_settings_schema_metadata.spec.ts::ignores a default entry inherited from the shared prototype | `Object.prototype.default=true`; `\href` URL not emitted | O ("library's own definitions and built-in defaults"), D | no — own read of the schema entry | low |
| …::ignores a default entry inherited from the shared prototype for a bare URL command | same, `\url` | O, D | no | low |
| …::ignores a value adjuster inherited from the shared prototype | `Object.prototype.processor=()=>true`, `{trust:false}`; URL not emitted | O, D | no — own read of `processor` | low |
| security/test_trust_context.spec.ts::does not accept a protocol inherited from the shared prototype | `Object.prototype.protocol="https"`, trust fn allows https; URL not emitted | G ("decide … what it permits") | no — own url/protocol, or an own-only decision object | low |
| …::does not accept an inherited protocol for a bare URL command | same, `\url` | G | no | low |
| …::does not give a context that carries no URL a protocol borrowed from the prototype | `Object.prototype.url` set; `\htmlClass` class not emitted | G | no — skipping derivation (or an own-only context) leaves the trust fn no protocol | low |
| security/test_macro_namespace.spec.ts::does not expand a name inherited from the shared prototype | `Object.prototype["\\pwn"]`; output has no `PWNED` (throw caught) | D | no — own read of the builtin fallback | low |
| …::does not let an inherited name replace a built-in command | `Object.prototype["\\href"]`; no `PWNED` | G ("replace"), D | no | low |
| …::does not expand an inherited name after it was set and restored inside a group | `{\def\pwn{}}\pwn`; no `PWNED` | D | no — own read in `get` and an `undefined` undo capture | low |
| security/test_auto_render_options.spec.ts::does not take a macro table inherited from the shared prototype | `Object.prototype.macros`; `renderMathInElement` innerHTML has no `PWNED` | G ("what it renders"), O | no — null-proto/own-key option copy closes the resolved copy | medium |
| …::does not take delimiters inherited from the shared prototype | `Object.prototype.delimiters`; no `.katex` | G | no | medium |
| security/test_trust_map.spec.ts::does not allow a protocol inherited from the shared prototype | `Object.prototype.javascript=true`, `trust:{https:true}`; URL not emitted | O ("in whatever form"), G | no — own-key check on the map | low |
| …::does not allow an inherited protocol for a bare URL command | same, `\url` | O, G | no | low |
| …::does not allow an inherited protocol for an image command | same, `\includegraphics` | O, G | no | low |
| …::does not allow an inherited protocol when the caller's map is empty | `Object.prototype.https=true`, `trust:{}`; https link not emitted | G, O | no — also rejects URL-sanitising "fixes" | low |
| security/test_html_attr.spec.ts::does not accept an event handler inherited from the shared prototype | `Object.prototype.onclick=true`; `\htmlAttr{onclick=…}` emits no `onclick` | G ("what it permits") | no — own read of the allowlist | low |
| …::does not accept another event handler inherited from the shared prototype | `onmouseover` | G | no | low |
| …::does not accept a third event handler inherited from the shared prototype | `onfocus` | G | no | low |
| functional/test_options_legit.spec.ts::still honours a caller trust function that allowlists a protocol | `trust` fn allows https; `href` present | T, K | no | low |
| …::still refuses a protocol the caller's trust function does not list | javascript `href` absent | T | no | low |
| …::still honours trust: true and a command-specific trust function | `true` allows; command-specific fn distinguishes `\url`/`\href` | T | no — `ff-overcoerce` fails here | low |
| …::still honours strict as a function, a string and a boolean | fn/"ignore" no throw; fn-true/"error" throw | T, K | no | low |
| …::still falls back to the built-in default when an own entry is undefined | `throwOnError:undefined` throws; `errorColor:undefined` → `#cc0000` | K ("an entry the caller explicitly leaves unset … falls back") | no — a hasOwn-only fix loses the fallback (wrong fix) | low |
| …::still accepts a settings instance as the options object | Settings instance works as options | T, K | no — instance fields are own | low |
| …::still applies the built-in value adjusters to the caller's own entries | maxSize/maxExpand/minRuleThickness clamps | T | no | low |
| …::still uses the caller's own entry when the shared prototype has one too | proto `trust`, `{trust:false}`; javascript `href` absent | G, O, K | no | low |
| functional/test_trust_contexts_legit.spec.ts::still passes the derived protocol of an absolute URL to the trust function | `command`,`url`,`protocol` seen | T | no | low |
| …::still passes a relative protocol marker to the trust function | `_relative` | T | no | low |
| …::still lets a trust function decide HTML commands from their own fields | `\htmlClass`/`\htmlId` decided on command/class/id | T | no | low |
| …::still gives an HTML command context no protocol of its own | `"protocol" in ctx` and `"url" in ctx` false | T | no — only a fix that injects `protocol:undefined` fails; that changes today's shape | low |
| …::still renders a link the caller's trust function allows | `\url` https allowed | T | no | low |
| functional/test_macros_legit.spec.ts::still expands the caller's own macros | `\RR` = `\mathbb{R}` | T | no | low |
| …::still expands macros the caller supplies as functions | fn macro | T | no | low |
| …::still resolves the built-in macros | `\TeX` | T | no | low |
| …::still writes global definitions back into the caller's macro table | `\gdef` mutates the caller's object | T (also project spec "\gdef changes settings.macros") | no — no sanitising copy is needed | low |
| …::still keeps local definitions out of the caller's macro table | `\def` leaves the table empty | T | no | low |
| …::still restores a locally redefined macro at the end of its group | group restore | T | no | low |
| …::still lets the caller's own definition win over an inherited entry of the same name | proto `\RR`, caller's own wins | O, G, T | no | low |
| functional/test_auto_render_legit.spec.ts::still renders the default delimiters | default `$$` renders | T | no | low |
| …::still accepts caller-supplied delimiters | `[[…]]` renders | T | no | low |
| …::still accepts a caller-supplied macro table | `\RR` renders, no `katex-error` | T | no | low |
| …::still skips ignored tags and ignored classes | `pre`/class skipped, one `.katex` | T | no | low |
| …::still calls the caller's error callback and keeps the source text | callback >0, text kept | T, R | no | low |
| functional/test_trust_map_legit.spec.ts::still allows a protocol the caller lists | `{https:true}`, https link present | T, K | no | low |
| …::still refuses a protocol the caller does not list | javascript absent | T | no | low |
| …::still honours an entry explicitly set to false | `{https:false}` refused | T, K | no | low |
| …::still allows a relative URL when the caller lists its marker | `{_relative:true}` | T, K | no | low |
| …::still handles images and bare URLs through the same map | `\url`/`\includegraphics` | T, K | no | low |
| functional/test_html_attr_legit.spec.ts::still sets a listed attribute without enabling trust | `title` set | T | no | low |
| …::still sets the other listed attributes without enabling trust | `role`,`aria-label` | T | no | low |
| …::still refuses an unlisted attribute when the page does not trust input | `onclick` refused | T, R | no | low |
| …::still sets an unlisted attribute when the page enables trust | `trust:true` sets `onclick` | T, K | no | low |
| …::still renders the body of the attribute command | `title` + body | T | no | low |
| functional/test/katex-spec.ts (623 pristine upstream tests, grouped) | unchanged project behaviour/snapshots | T | no — oracle/pass-alt/blind are 658/658 | low |

## 2. Leniency (quality, non-blocking)

| Trap / property | Most plausible wrong fix | Caught by |
|---|---|---|
| T1 settings options | copy options with `Object.assign({}, options)`/spread, read the copy; or delete polluted keys once at import | yes — `test_settings_options` #1 (planted after import) |
| T8 value forms | Boolean-coerce supplied options | yes — `ff-overcoerce.patch` (7 security + 103 functional); `test_options_legit` #1,#3,#4,#6 |
| T8 value forms | hasOwn-only, no own-`undefined` fallback | yes — `test_options_legit` #5 |
| T8 / refuse-all | refuse every trusted command | yes — `ff-refuse-trusted.patch` (32 functional); `test_options_legit` #1,#3 |
| T2 schema metadata | fix only the `options[prop]` read | yes — `miss_schema_metadata.patch`; `test_settings_schema_metadata` #1–#3 |
| T2 schema metadata | guard `default`, not `processor` | yes — `test_settings_schema_metadata` #3 |
| T3 trust context | own-check only `\href` | yes — `sf-href-only.patch`; `test_trust_context` #2,#3 |
| T3 trust context | guard `protocol`, not `url` | yes — `test_trust_context` #3 |
| T3 trust context | sanitise `javascript:` URLs instead of the trust decision | yes — `test_trust_map` #4 (own-empty map + https must refuse) |
| T4 macro namespace | guard only the per-render map | yes — `test_macro_namespace` #1,#2 (nop) |
| T5 namespace undo | fix `get`, not the undo capture | yes — `sf-get-only.patch`; `test_macro_namespace` #3 |
| T7 auto-render | fix only Settings/Namespace | yes — `miss_auto_render.patch`; `test_auto_render_options` #1,#2 |
| S1 trust map | copy the map into a plain object / use `in` / `for…in` | yes — `test_trust_map` #1–#4 |
| S2 html attr | remove `\htmlAttr` or always require trust | yes — functional `test_html_attr_legit` #1,#2,#4,#5 |
| S2 html attr | `name in SAFE_ATTRIBUTES` | yes — `test_html_attr` #1–#3 |
| S2 html attr | block only `on*` names | **no** — all three tests plant event handlers; an inherited `srcdoc`/`style` would still skip trust |
| all | published fix only (`upstream_fix.patch`) | yes — 12 security fails (T3, T7, S1, S2) |
| T3 trust context | own-check url/protocol only, leaving `command`/`class`/`id`/`name`/`attributes` inherited | **no** — no test plants those; the reference fix passes the original context to the trust function |
| T5 namespace undo | record undo only when the name has an own value (skip instead of recording `undefined`) | **no** — a group-local new `\def` then leaks; `test_macro_namespace` #3 only checks `PWNED` |
| T7 auto-render | own-read macros/delimiters but keep `options?.ignoredTags` / `errorCallback` | **no** — `proto.ts` lists `ignoredTags`/`ignoredClasses`/`errorCallback` but no test plants them |

## 3. Hints (quality, non-blocking)

| Quote | Why it hints | Neutral wording |
|---|---|---|
| "Caller-supplied configuration and caller-supplied definitions keep their meaning in whatever form the caller provides them, including an entry the caller explicitly leaves unset, which still falls back to the library's own default; and a caller that deliberately permits something still gets the same result it gets today." | paraphrases T8's value shapes (function/string/map/undefined/instance) and the refuse-all trap; "whatever form" is a variant list | "Everything that works today keeps working exactly as today." |
| "A fix that special-cases one observed form rather than establishing the property is not enough; the property must hold for every way the library consumes caller input and its own definitions." | names the fix approach and tells the solver to sweep every consumer (a checklist) | delete; "What must hold" already quantifies over every value |
| "Do not look up the upstream fix for this issue." | reveals that a published fix exists and points at the intended source | "Solve this from the repository and this description alone." |

## 4. Realism (quality, non-blocking)

T1/T2/T4/T5 are the published fix's own sites; T3/T7 are real, unmodified upstream routes and are in
scope by definition. S1 (a protocol map folded into `trust`, normalised in the constructor) and S2
(`\htmlAttr` whose annotation-only allowlist is consulted before the trust check) both read as
maintainer code and are reachable through `renderToString`. Nothing looks planted or contrived; S1's
new public option form is the only mildly synthetic note.

## 5. Verdict

**Gate a — READY.** Every security test drives a route governed by G or D read literally (markup
decided, permission decided, or a definition used), including T3, T7, S1 and S2. Every functional
test is today's behaviour (T/K). Three independent correct fixes — oracle, `pass-alt`, `blind.patch`
— pass all 22 + 658 tests; no test demands a particular layer, error class or status, and the
refusal assertions accept "not rendered". The custom-prototype options case (T1 #2) is the one
borderline reading; it is resolved by O ("the caller's own input") and the primary mechanism, so no
correct primary-mechanism fix fails. The instruction's "throwing is a valid refusal" is a secondary
allowance: a throw-based implementation would fail the unguarded files, but that is an alternative
implementation (gate b), not the stated mechanism.

### Required: generalize

- "typesets LaTeX in web pages and in server-side rendering" — two delivery channels; drop to
  "typesets LaTeX" (the property already covers all rendering).
- The bullet-2 value-form sentence quoted in Hints #1 — exists only to cover T8 and the refuse-all
  trap; replace with "Everything that works today keeps working exactly as today."

### Quality to tighten

- Trust context: plant `Object.prototype.class`/`command` and require the trust function to see own
  fields only; `blind.patch` already filters the whole context, the reference fix does not.
- S2: add a non-`on` inherited attribute (`srcdoc`, `style`) so an `on*` denylist cannot pass; the
  three event-handler cases are near-duplicates.
- T7: plant `Object.prototype.ignoredTags`/`errorCallback`; the manifest shape names the ignored-tag
  list but no test uses it.
- T5: add `{\def\q{}\q}\q` asserting `\q` is undefined after the group, so a capture that skips
  unrecorded names fails.
- Refusal form: wrap the unguarded hostile renders in try/catch as the macro tests do, or narrow the
  instruction's refusal sentence to the existing unsupported rendering.

Human review: confirm that "the caller's own input" is intended to exclude a front object's custom
prototype (security/test_settings_options #2), and whether "throwing is a valid refusal" should be
honoured by the unguarded security tests.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
