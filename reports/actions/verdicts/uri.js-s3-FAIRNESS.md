# FAIRNESS — uri.js-s3 (injected track, medialize/URI.js)

Reviewed: `tasks/uri.js-s3/instruction.md`, every file under `tests/`, `solution/fix.patch`,
`build/uri.js-s3/{manifest.json,notes.md,checks/*.patch}`. Nothing was run.

## Covering sentences

- **P** — "For any string a caller supplies, the host the library reports — by itself, and when it
  resolves a reference from a base — must be the host a standards-compliant browser reaches for that
  same string."
- **S** — "The same holds whenever the library answers whether a location stays on a given host: it
  may never treat a location that a browser sends elsewhere as staying on that host, and it may
  never name a host other than the browser's."
- **K1** — "Everything that works today keeps working exactly as today."
- **K2** — "Strings whose scheme names no location — mail addresses, ISBNs and the like — still have
  no host and keep their current path."
- **K3** — "An ordinary web location, a plain relative path or a protocol-relative link keeps the
  host, path, query and fragment it has today."
- **K4** — "When a reference is not absolute, the answer is the one a browser gets resolving that
  reference from the base the library is given."
- **K5** — "A location a browser resolves to the same host keeps being reported as staying on that
  host, however its authority is written."
- **WH** — standard expert knowledge, WHATWG URL: `http`, `https`, `ftp`, `ws`, `wss` are special
  schemes; scheme comparison is ASCII case-insensitive; after the colon any run of `/` and `\`
  (including none) introduces the authority; a reference beginning with two or more `/` or `\` is a
  scheme-relative reference resolved against the base; userinfo ends at the last `@` before the path.

Harness: the security group drives `URI(s)`, `URI.parse(s)`, `URI(s, base)`, `.absoluteTo(base)`,
`.href()`, `.origin()`, `URI.isSameOrigin(url, base)` and `src/URI.min.js` loaded as a `<script>`
(vm window, no module). The instruction offers no refusal form; a throw fails
(`checks/sec_throw.patch`).

## 1. Per-test fairness

Security rows are `tests/security/cases.js::<classname>::<name>`; functional rows are
`tests/functional/cases.js::<classname>::<name>`; the project row is
`tests/functional/project/run.js`.

| test (file::name) | what it asserts | covering sentence | could a correct fix fail? | risk |
|---|---|---|---|---|
| security/cases.js::security/scheme::a web location with no separator still names its host | `URI('https:attacker.example').hostname() === 'attacker.example'` | P + WH (empty delimiter run) | no — delimiter normalisation passes (oracle, blind) | low |
| security/cases.js::security/scheme::a web location with one separator still names its host | `URI('https:/attacker.example')` → `attacker.example` | P + WH | no | low |
| security/cases.js::security/scheme::a separator written with both separators still names its host | `URI('https:/\/\attacker.example')` → `attacker.example` | P + WH (any `/`/`\` run) | no | low |
| security/cases.js::security/scheme::a differently capitalised web scheme still names its host | `URI('hTTps:attacker.example')` → `attacker.example` | P + WH (case-insensitive scheme) | no | low |
| security/cases.js::security/scheme::a transfer scheme with no separator still names its host | `URI('ftp:attacker.example')` → `attacker.example` | P + WH (`ftp` is special) | no | low |
| security/cases.js::security/scheme::a socket scheme with one separator still names its host | `URI('wss:/attacker.example')` → `attacker.example` | P + WH (`wss` is special) | no | low |
| security/cases.js::security/scheme::the documented parse entry reports the same host | `URI.parse('https:attacker.example').hostname` → `attacker.example` | P (the parse entry reports a host) | no | low |
| security/cases.js::security/scheme::replacing the address of a URI reports the same host | `URI('http://victim.example/').href('https:attacker.example').hostname()` → `attacker.example` | P (the href setter reports the supplied string's host) | no | low |
| security/cases.js::security/scheme::setting a URI from a location reports the same origin | `.origin('https:attacker.example').origin() === 'https://attacker.example'` | P (origin reports the host) | no | low |
| security/cases.js::security/reference::excess forward separators resolves to the host the browser reaches | `URI('////attacker.example/x', BASE).hostname()` → `attacker.example` | P + K4 + WH (2+ leading `/` is scheme-relative) | no | low |
| security/cases.js::security/reference::excess forward separators resolves to that host through the absolute form | `URI('////attacker.example/x').absoluteTo(BASE).hostname()` → `attacker.example` | P ("resolves a reference from a base") + K4 | no | low |
| security/cases.js::security/reference::a pair of back separators resolves to the host the browser reaches | `URI('\\\\attacker.example/x', BASE)` → `attacker.example` | P + K4 + WH (`\` is a separator for special schemes) | no | low |
| security/cases.js::security/reference::a pair of back separators resolves to that host through the absolute form | `.absoluteTo(BASE)` on the same input → `attacker.example` | P + K4 | no | low |
| security/cases.js::security/reference::forward then back resolves to the host the browser reaches | `URI('/\attacker.example/x', BASE)` → `attacker.example` | P + K4 + WH | no | low |
| security/cases.js::security/reference::forward then back resolves to that host through the absolute form | `.absoluteTo(BASE)` → `attacker.example` | P + K4 | no | low |
| security/cases.js::security/reference::back then forward resolves to the host the browser reaches | `URI('\/attacker.example/x', BASE)` → `attacker.example` | P + K4 + WH | no | low |
| security/cases.js::security/reference::back then forward resolves to that host through the absolute form | `.absoluteTo(BASE)` → `attacker.example` | P + K4 | no | low |
| security/cases.js::security/reference::three forward separators resolves to the host the browser reaches | `URI('///attacker.example/x', BASE)` → `attacker.example` | P + K4 + WH | no | low |
| security/cases.js::security/reference::three forward separators resolves to that host through the absolute form | `.absoluteTo(BASE)` → `attacker.example` | P + K4 | no | low |
| security/cases.js::security/reference::a resolved reference reports the host in its origin | `URI('////attacker.example/x', BASE).origin() === 'https://attacker.example'` | P (origin reports the host) + K4 | no | low |
| security/cases.js::security/bundle::the shipped build names the host of a location with no separator | `bundle()('https:attacker.example').hostname()` → `attacker.example` | P + WH | no — the same rule applied to the shipped copy passes; editing only `src/URI.js` leaves a shipped copy reporting the wrong host (incomplete, not a correct reading of P) | medium |
| security/cases.js::security/bundle::the shipped build names the host of a location with one separator | `bundle()('https:/attacker.example')` → `attacker.example` | P + WH | no (same caveat) | medium |
| security/cases.js::security/bundle::the shipped build names the host of an over-separated location | `bundle()('https://////attacker.example')` → `attacker.example` | P + WH | no (same caveat) | medium |
| security/cases.js::security/bundle::the shipped build names the host of a capitalised web scheme | `bundle()('hTTps://////attacker.example')` → `attacker.example` | P + WH | no (same caveat) | medium |
| security/cases.js::security/bundle::the shipped build names the host of a mixed separator run | `bundle()('https:/\/\attacker.example')` → `attacker.example` | P + WH | no (same caveat) | medium |
| security/cases.js::security/bundle::the shipped build names the host of an over-separated transfer location | `bundle()('ftp:////attacker.example')` → `attacker.example` | P + WH | no (same caveat) | medium |
| security/cases.js::security/bundle::the shipped build resolves an over-separated reference off-site | `bundle()('////attacker.example/x', BASE)` → `attacker.example` | P + K4 + WH | no — needs both the shipped-copy and reference rules; the oracle/blind do both | medium |
| security/cases.js::security/bundle::the shipped build resolves a back-separated reference off-site | `bundle()('\\\\attacker.example/x', BASE)` → `attacker.example` | P + K4 + WH | no (same caveat) | medium |
| security/cases.js::security/comparison::credentials spelled like the base host do not make the target local | `URI.isSameOrigin('https://victim.example@attacker.example/x', 'https://victim.example/') === false` | S + WH (the host follows the userinfo) | no — a parsed-host comparison passes | low |
| security/cases.js::security/comparison::the same spelling under another scheme is not local either | same with `wss://` on both sides → `false` | S | no | low |
| security/cases.js::security/comparison::a port after the credentials does not make the target local | `http://victim.example@attacker.example:8080/x` vs `http://victim.example/` → `false` | S + WH | no | low |
| security/cases.js::security/absolute::over-separated https still names its host | `URI('https://////attacker.example').hostname()` → `attacker.example` | P + WH | no — the rule must run ahead of the parser's well-formed shortcut; the oracle does | low |
| security/cases.js::security/absolute::three separators still names its host | `URI('https:///attacker.example/x')` → `attacker.example` | P + WH | no | low |
| security/cases.js::security/absolute::over-separated capitalised scheme still names its host | `URI('hTTps://////attacker.example')` → `attacker.example` | P + WH | no | low |
| security/cases.js::security/absolute::over-separated ftp still names its host | `URI('ftp:////attacker.example/x')` → `attacker.example` | P + WH | no | low |
| security/cases.js::security/absolute::the documented parse entry names that host too | `URI.parse('https://////attacker.example').hostname` → `attacker.example` | P | no | low |
| functional/cases.js::functional/parsing::a mail address identifier keeps its path and has no host | `URI('mailto:hello@example.org')`: urn, hostname `''`, path, protocol | K1 + K2 | no | low |
| functional/cases.js::functional/parsing::an isbn identifier keeps its colon-separated path | `URI('urn:isbn:0451450523')`: urn, hostname `''`, path `isbn:0451450523` | K1 + K2 | no | low |
| functional/cases.js::functional/parsing::an application scheme without an authority stays an identifier | `URI('custom:foo/bar')`: urn, hostname `''`, path `foo/bar` | K1 + K2 | no | low |
| functional/cases.js::functional/parsing::an ordinary web location keeps all its components | `https://example.org/a/b?x=1#f`: host, path, query, fragment, origin, toString | K1 + K3 | no | low |
| functional/cases.js::functional/parsing::credentials and a port keep their values | `http://user:pass@example.org:8080/p` → host/user/password/port/path | K1 + K3 | no | low |
| functional/cases.js::functional/parsing::an address literal keeps its host and port | `http://[2001:db8::1]:80/x` → host/port/path | K1 + K3 | no | low |
| functional/cases.js::functional/parsing::a protocol-relative location keeps its host | `URI('//example.org/x')`: host, protocol `''`, path | K1 + K3 | no | low |
| functional/cases.js::functional/parsing::an empty path on a web location becomes the root | `URI('https://example.org').path() === '/'` | K1 + K3 | no | low |
| functional/cases.js::functional/parsing::a doubled separator inside the path is preserved | `URI('https://example.org/a//b').path() === '/a//b'` | K1 + K3 | no — the correct rule is anchored at the leading run only; a global collapse is wrong and is caught | low |
| functional/cases.js::functional/parsing::a hostless path is still relative, a web location is not | `URI('/x').is('relative')`, `URI('https://example.org/x').is('relative') === false` | K1 + K3 | no | low |
| functional/cases.js::functional/reference::a root-relative reference stays on the base host | `URI('/a/b', BASE)`: host `victim.example`, path `/a/b` | K1 + K4 | no | low |
| functional/cases.js::functional/reference::a path-relative reference stays on the base host | `URI('a/b', BASE)`: host `victim.example`, path `/app/a/b` | K1 + K4 | no | low |
| functional/cases.js::functional/reference::a query-only reference stays on the base host | `URI('?q=1', BASE)`: host `victim.example`, path `/app/` | K1 + K4 | no | low |
| functional/cases.js::functional/reference::a fragment-only reference stays on the base host | `URI('#f', BASE)`: host `victim.example`, path `/app/` | K1 + K4 | no | low |
| functional/cases.js::functional/reference::a protocol-relative reference takes its own host | `URI('//example.org/x', BASE)` → host `example.org`, path `/x` | K1 + K4/K5 | no | low |
| functional/cases.js::functional/comparison::an ordinary same-host location is local | `URI.isSameOrigin('https://victim.example/x', BASE) === true` | K1 + K5 | no | low |
| functional/cases.js::functional/comparison::a path reference is local to its base | `URI.isSameOrigin('/x', BASE) === true` | K1 + K5 (the browser resolves it to the base host) | no | low |
| functional/cases.js::functional/comparison::a same-host protocol-relative reference is local | `URI.isSameOrigin('//victim.example/x', BASE) === true` | K1 + K5 | no | low |
| functional/cases.js::functional/comparison::a different host is not local | `URI.isSameOrigin('https://example.org/x', BASE) === false` | K1 + S | no | low |
| functional/cases.js::functional/comparison::credentials that match the host still leave it local | `URI.isSameOrigin('https://victim.example@victim.example/x', BASE) === true` | K5 ("however its authority is written") | no — an over-restrictive "any `@` means foreign" rule is not correct and is caught | low |
| functional/cases.js::functional/bundle::the shipped build parses an ordinary web location | bundle host/path/query/fragment | K1 | no | low |
| functional/cases.js::functional/bundle::the shipped build keeps an identifier hostless | bundle `mailto:`: urn, hostname `''`, path | K1 + K2 | no | low |
| functional/cases.js::functional/bundle::the shipped build keeps a protocol-relative host | bundle `//example.org/x` → `example.org` | K1 + K3 | no | low |
| functional/cases.js::functional/bundle::the shipped build resolves a root-relative reference locally | bundle `('/a/b', BASE)`: host `victim.example`, path `/a/b` | K1 + K4 | no | low |
| tests/functional/project/run.js::project/parse::parse #1..#45 (45 cases) | the project's own pristine `test/urls.js` table: toString, every `_parts` field, every accessor and every `is()` answer for 45 URLs (incl. `mailto:`, `magnet:`, `http://i.xss.com\...`, `https://attacker.com\@example.com`) | K1 | no — oracle, pass_alt, pass_hardening and blind are green; only a global slash collapse fails | low |

## 2. Leniency (quality, non-blocking)

| property / trap | most plausible WRONG fix | caught? | evidence |
|---|---|---|---|
| P / `base_scheme_delimiter` | special-case the reported `https:` spelling (or lowercase `http(s)` only) | yes | four scheme variants (capitalised, ftp, wss, mixed) + parse/href/origin cases; `checks/sec_miss_base.patch` fails 9 |
| P / `base_scheme_delimiter` | rewrite in the constructor only, not in `URI.parse` | yes | "the documented parse entry reports the same host"; "…names that host too" |
| P / `injected_fast_path` | place the one-line repair at the upstream spot below the well-formed fast path | yes | 5 `security/absolute` cases; `checks/sec_miss_fastpath.patch` |
| P + K4 / `uncovered_reference` | fix only scheme-delimited absolutes and leave base resolution alone | yes | 11 `security/reference` cases (+2 bundle references); `checks/sec_miss_relative.patch` |
| P + K4 / `uncovered_reference` | normalise a leading `//` run only, not `\\` and mixed runs | yes | the four back/mixed reference inputs, each in both forms |
| P / `shipped_build` | edit `src/URI.js` only, leave the shipped copy | yes | 8 `security/bundle` cases; `checks/sec_miss_bundle.patch` |
| S / `injected_comparison` | keep the raw-authority slice (the bug) | yes | 3 `security/comparison` cases; `checks/sec_miss_comparator.patch` |
| S / `injected_comparison` | reject any authority containing `@` | yes | `functional/comparison::credentials that match the host still leave it local`; `checks/func_refuse_all.patch` (0 sec / 4 fun) |
| refuse all | throw for a web scheme with no authority | yes | all 36 security fail; `checks/sec_throw.patch` |
| over-broad | collapse every `/`/`\` run in the whole string | yes | `functional/parsing::a doubled separator inside the path is preserved` + 15 functional, 11 security; `checks/func_overbroad.patch` |

Catalogue: `refuse_all`/`adjacent_api` → `func_refuse_all`/`func_overbroad` (caught);
`crash_as_refusal` → `sec_throw` (caught); `wrong_resource`/`malformed_identity` →
`sec_miss_comparator` (caught); `check_after_adjustment` → `sec_miss_fastpath` (caught);
`unlisted_route` → `sec_miss_relative` (caught); `missing_authority` → `sec_miss_base` (caught);
`one_role_or_direction` and `reads_only` are n/a (no roles/peers, no read/write split).

**Wrong fixes no test catches**

1. **Hardcoding the host.** Every security case expects the single literal `attacker.example` (the
   comparison cases expect `false`, which a host-based answer also yields). A fix that recognises
   that literal scores 1.0. Remedy: use a second unrelated host in at least one case per trap.
2. **Host reported, remainder mangled.** Security cases assert only `hostname`/`origin`; a fix that
   reports the right host but leaves `urn: true`, or drops/rewrites `path`/`query`, is not caught.
   Remedy: add literal `path` (and `urn` for hostless) assertions to a few hostile inputs.
3. **`isSameOrigin` for hostless identifiers.** A fix returning `true` for `mailto:`/`urn:` passes;
   the oracle returns `false`. Remedy: one case.
4. **Same host, different scheme** (`http://victim.example` vs an `https` base) is untested; a
   host-only comparison passes. Optional: the instruction speaks of "stays on a given host".
5. **A single leading `\` reference** (the browser keeps the base host) is untested; a fix that
   treats a single backslash as an authority passes (a single `/` is guarded by the functional
   root-relative case). Remedy: `URI('\attacker.example/x', BASE).hostname() === 'victim.example'`.
6. **Scope leniency, not a wrong fix:** leading whitespace, CR/LF/TAB and excessive colons are
   untested (the manifest notes them); a fix ignoring them still scores 1.0.

## 3. Hints (quality, non-blocking)

| quote | why it is a hint | neutral wording |
|---|---|---|
| "Fix the problem and its close variants, not just the example." | announces a variant family and the generalise approach | delete; P already quantifies over any string |
| "This is one invariant, not a list of cases; the spelling above is an example." | tells the solver there are other spellings (flaw count/variant list) | delete; P does that work |
| "do not special-case the example." | names the fix approach and points at the example | delete |
| "Strings whose scheme names no location — mail addresses, ISBNs and the like — still have no host and keep their current path." | names the concrete identifier classes the functional suite pins | "Strings whose scheme names no location still have no host and keep their current path." |
| "An ordinary web location, a plain relative path or a protocol-relative link keeps the host, path, query and fragment it has today." | enumerates the legitimate shapes (a variant list) | "Every location that works today keeps its host, path, query and fragment." |
| "Do not consult the upstream advisory or fix for this issue" | acceptable; reveals only that a published fix exists | keep |
| the `https:attacker.example` example | the reported case, not a variant list; it is the task's reason to exist | keep |

## 3a. Required: generalize

- "This project is a small JavaScript library for parsing, comparing and rewriting URLs." — names
  the three operations (parse, comparison, rewrite setters), one of which is the sibling same-site
  helper. Reword: "This project is a small JavaScript library for working with URL strings."
- Not flagged: "by itself, and when it resolves a reference from a base" and "whenever the library
  answers whether a location stays on a given host" quantify over the input/outcome of the one
  property; deleting them would leave the reference and comparison tests uncovered by it.

## 4. Realism (quality, non-blocking)

- `base_scheme_delimiter` (`src/URI.js:525-540`), `uncovered_reference` (`src/URI.js:525-531`,
  unmodified upstream, later fixed upstream by 88805fd) and `shipped_build` (`src/URI.min.js:37-38`,
  patched separately upstream in 6ea641c) are real upstream code at the pin and reachable through
  the public API. Never "beyond the advisory".
- `injected_fast_path` (`src/URI.js:516-523`) is a plausible maintainer shortcut at the top of
  `parse` reusing `parseAuthority`, reachable on every `scheme://` input. Slightly engineered (it
  duplicates the generic branch for well-formed input), but registered in
  `build/audit/uncovered-routes.tsv`; not contrived.
- `injected_comparison` (`src/URI.js:2281-2298`) is a plausible allow-list convenience; slicing the
  raw authority by hand is a realistic maintainer mistake. Synthetic only in that the helper is
  injected.
- `src/URI.min.js` has no in-repo generator (the Gruntfile is jshint-only), so a correct fix must
  hand-edit the copy; unusual, but the file is real and the oracle, blind and both passing checks do
  it.
- Harness: hidden suites import the submitted `src/URI.js`; the pristine project table comes from
  `/tests`; the shipped build is loaded as a script (vm window, no module), its documented use. No
  harness-only route.

## 5. Verdict

**Gate a: READY.** The natural correct fix following P — normalise the special-scheme delimiter
(any `/`/`\` run, case-insensitive) and the leading scheme-relative run before the authority split,
apply the same rules to the shipped copy, and derive same-site answers from the parsed host —
passes 36/36 security and 69/69 functional: the oracle, `pass_alt`, `pass_hardening` and the
structurally different `blind` fix are all 1.0; each `sec_miss_*` patch fails only its lever; the
functional-fail patches show over-broad and refuse-all fixes being rejected. Every asserted value
matches WHATWG, no test demands a refusal form, and no assertion is derived from hidden material.
The K3/K4 wording tension over `////`-shaped references does not make a correct fix fail: K4
expressly governs a non-absolute reference resolved from a base, which is how those tests are
driven. The eight shipped-build cases fail only a fix that patches one of the library's two shipped
copies (real upstream code visible as `src/URI.min.js`) — a model failure, not a correct-fix
counter-example. Judgment point: instruction.md never mentions the second distribution, and every
completed recorded trial stops at 0.7778 — 8 failures, consistent with exactly these bundle cases
(one timed-out run scores 0.4722; its per-test record is 11 reference + 8 bundle).

**Required: generalize (3a):** the "parsing, comparing and rewriting" sentence above.

**Quality to tighten:** add a second host to the security table (hardcoding `attacker.example`
passes); assert `path`/`urn` on a few hostile inputs; add `isSameOrigin('mailto:…', BASE) === false`
and optionally a same-host/different-scheme case; add a single-leading-`\` reference that must keep
the base host; neutralize the hint and 3a wording above.

**Human review:** confirm (i) the shipped browser build is fairly within "the host the library
reports" even though instruction.md never mentions a second distribution and there is no in-repo
generator, and (ii) the "plain relative path / protocol-relative link keeps … today" bullet is read
subject to K4, not as preserving the base host for `////`/`\\\\` references.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
