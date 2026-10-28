# pagy-s2 — build notes

- **Started:** 2026-10-27T22:24:06Z
- **Finished:** 2026-10-27T22:51:30Z
- **Advisory:** GHSA-2XMW-F8J8-WFXC / CVE-2026-54659 (ddnexus/pagy)
- **Pinned:** cbc77ebba1fc839345e78714eef41e3f672b6205 (v43.5.5)
- **Published fix:** efcf09690e9fa7d7abdfb987b785a55f87e287df
- **Pattern:** A+B, **track:** injected
- **Task slug:** pagy-s2

## What the published fix does (verified against the fix commit)

One commit, source changes in two files:

1. `gem/lib/pagy/modules/i18n/i18n.rb` — adds
   `LOCALE_PATTERN = /\A[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*\z/` and changes the setter from
   `Thread.current[:pagy_locale] = value.to_s` to `value.to_s[LOCALE_PATTERN]`. The actual path
   join is one private method lower (`load`, `pathnames.reverse.map { |p| p.join("#{locale}.yml") }`).
2. `gem/lib/pagy/modules/abilities/configurable.rb` — `dev_tools(wand_scale:)` interpolates
   `wand_scale` into `data-scale="..."`; the fix coerces it with `.to_f`.
   `src/wand.ts` only changes a documentation string.

The fix adds regression tests to the pinned project test files; the pinned commit does not contain
them (checked with `git log cbc77ebb..efcf0969 -- test/`). Those fixed-commit tests are not used as
hidden tests here.

## Security properties (written once, before routes were chosen)

**P1 (locale → file):** No value supplied as a language name may make the library read or load a
locale file from outside the directory it is looking that language up in, however the value reaches
the library.

**P2 (option → markup):** No value supplied as an option or argument may end the HTML attribute or
element it is placed in within markup the library generates; the value must stay inside the place
it was meant for.

Both are stated in `instruction.md` without naming any route, file, function, or option.
Everything below is covered by one of those two sentences.

## Every candidate sibling site / route found (screener leads + own search)

Screener O8 (uncovered routes into the locale→path sink):

- U1 `Pagy::Calendar.localize_with_rails_i18n_gem(*locales)` — `path.join("rails/locale/#{locale}.yml")`
  appended to `::I18n.load_path` (`gem/lib/pagy/classes/calendar/calendar.rb:24-32`). **REAL**, confirmed
  by a behavioural probe on the pinned tree (marker file outside the fake gem's `rails/locale` dir was
  loaded and returned through `::I18n.t`).
- U2 private `Pagy::I18n.load(locale:)` called directly — same join (`i18n.rb:42-49`). Real but private
  and only reachable by `send`; rejected as an entry point (not a real public surface).
- U3 direct `Thread.current[:pagy_locale]` write, bypassing the setter; getter returns it and `load`
  joins it (`i18n.rb:23-27`). **REAL**, confirmed behaviourally. Chosen (T2).
- U4 a thread that carries an invalid locale from the setter — subsumed by T2.

Screener O8b (injection room / other sinks found by searching):

- V1 `Pagy.sync(resource, destination, *targets)` interpolates names into a glob and copies files
  (`configurable.rb:8-12`). Different protected outcome (copy destination, developer-supplied), not
  the locale read; rejected as outside this advisory's protection.
- V2 `nav_aria_label_attribute(aria_label:)` interpolates a caller option into `aria-label="..."`
  (`toolbox/helpers/support/nav_aria_label_attribute.rb:8`). **REAL**, confirmed; chosen (T5).
- V3 `a_lambda` interpolates `classes:`/`aria_label:` into attributes
  (`toolbox/helpers/support/a_lambda.rb:33`). **REAL**, confirmed through `previous_tag` (T6).
- V4 `anchor_tag_for` interpolates `aria_label` in its disabled-link branch
  (`toolbox/helpers/anchor_tags.rb:15`). **REAL**, confirmed; tied to T6.
- V5 `wrap_series_nav` interpolates caller `id:` (`wrap_series_nav.rb:13`). **REAL**, confirmed (T7).
- V6 `info_tag(id:)` interpolates caller `id:` (`info_tag.rb:27`). **REAL**, confirmed (T7).
- V7 `limit_tag_js(id:, max_limit:)` interpolates caller `id:` (`limit_tag_js.rb:15`). Real, same shape
  as V5/V6; not chosen (more routes of one concept).
- V8 `Pagy::I18n.load` joins `p11n` from dictionary data via `Object.const_get` (`i18n.rb:55`). Real but
  the value comes from a dictionary file, not from a caller-supplied locale name; different protection.
- V9 `Pagy::Request#resolve_page/resolve_limit` coerce URL params (`classes/request.rb`). Different
  protection; out of scope.

Injected-gap candidates (code a maintainer could plausibly have left):

- I1 a public read-only dictionary lookup helper in the i18n module (`dictionary_for`) that repeats the
  locale→path join. Plausible tooling API. **CHOSEN (T3)**.
- I2 a new caller `title:` presentation option on the production `info_tag` helper, interpolated as an
  attribute. Plausible tooltip. **CHOSEN (T8)**.
- I3 a generalized calendar localization helper next to the rails-i18n one. Rejected: it would sit on
  the same lines as T4, so it adds no search distance.
- I4 a `Pagy.stylesheet_tag(media:)` link helper. Rejected: same file as the published dev-tools fix
  (configurable.rb), so the failing sink would be in the fix's own file.
- I5 a CLI locale-copy command. Rejected: a new user-visible CLI feature is more than a maintainer
  sibling and needs a process-level test surface.

### Why the picks beat the others

- **T2 (thread-local) beats U2:** public `translate` still reads the storage, so the route is real
  without `send`; and it is how-type: a correct fix has to guard the sink/getter, not only the setter.
- **T3 (injected dictionary helper) beats I3/I4:** a second read path in a different method, fixed by
  neither the published setter hunk nor a sink-only fix that forgets the helper.
- **T4 (Calendar) beats U2:** a public developer-facing API in a different package, real unmodified
  upstream code, and the published fix never touches it.
- **T5/T6/T7 (aria-label, link label, ids) beat V7:** they are spread over three packages and three
  different call paths (nav element, disabled/active anchor, info span); V7 would be a fourth copy of
  the same helper shape.
- **T8 (injected info title) beats I4:** it is in a production helper the report never mentions, so a
  solver who only fixes the reported dev-tools sink misses it.

## Levers (one line each)

- **T1 (reported, base):** locale value set through the public per-request selection reaches the
  dictionary path join; marker file outside the configured dictionary dir is loaded.
  `gem/lib/pagy/modules/i18n/i18n.rb:22-23,42-49` (published fix site).
- **T2 (pattern B, real, how-type):** the same sink read through the per-request storage written
  directly, bypassing the setter: a sink-level guard is required, a setter-only fix misses it.
  `i18n.rb:23-27,42-49`. Reason to dismiss: thread-local written by application glue, not the public
  setter.
- **T3 (injected, second read path):** public dictionary-inspection helper repeats the locale→path
  join and reads YAML; `i18n.rb` (injected method). Reason to dismiss: tooling/introspection API whose
  caller is expected to pass a known locale.
- **T4 (pattern B, real):** calendar localization registers `rails/locale/<locale>.yml` under a
  dependency's path; a traversal locale registers a file outside that directory and it is loaded.
  `gem/lib/pagy/classes/calendar/calendar.rb:24-32`. Reason to dismiss: optional, boot-time
  developer configuration for one backend.
- **T5 (pattern A far site, real):** the developer helper interpolates the display scale into an HTML
  attribute; a crafted scale ends the attribute and adds a script element.
  `gem/lib/pagy/modules/abilities/configurable.rb:16-28` (published fix site, different module).
  Reason to dismiss: development-only debug markup, the scale is a literal the developer types.
- **T6 (pattern B, real):** caller accessible labels/attributes on link helpers are interpolated
  unescaped (nav aria-label and disabled-link aria-label). `nav_aria_label_attribute.rb:8`,
  `anchor_tags.rb:15`, `a_lambda.rb:33`. Reason to dismiss: accessibility presentation options in the
  helpers package.
- **T7 (pattern B, real):** caller `id:` options on nav/info helpers are interpolated unescaped.
  `wrap_series_nav.rb:13`, `info_tag.rb:27`. Reason to dismiss: element ids are internal presentation
  labels.
- **T8 (injected, option sink):** a new caller `title:` presentation option on the production info
  helper is interpolated unescaped; `toolbox/helpers/info_tag.rb` (injected parameter). Reason to
  dismiss: a tooltip next to a translated string, in a helper unrelated to the dev-tools markup.

## Input shapes the security suite covers

Locale: parent-directory reference (`../x`), a value with a valid language prefix and a path
separator (`pt-BR/../../x`), a deep parent reference (`../../x`), and the same shapes through the
direct storage route. Markup: an attribute-breaking payload (quote + new attribute), a tag-breaking
payload (quote + `<script>`).

## Coupled must-keep-working behaviour

- Region subtags still resolve to their shipped dictionaries (`pt-BR`, `sv-SE`).
- Symbol language values still work (`:es`).
- `nil` still yields default-language output.
- A well-formed language name with no shipped dictionary keeps being the selected language and
  translation falls back to the default (`zh-Hant-CN`).
- Default and fractional numeric scales still render as numbers in the dev helper.
- Plain accessible labels, element ids and the new tooltip still render.
- The project's own locale-file test (`test/unit/pagy/modules/i18n/locales_test.rb`, pinned copy,
  run unchanged against a minimal harness) still passes.

## Verification plan

Local behavioural probes on the pinned tree confirmed T1, T2, T4, T5, T6 (aria label + a_lambda),
T7 (series nav id; info id). T3/T8 are injected and will be probed after the injection patch.
Then: nop (all security fail, all functional pass), oracle (reward 1.0), patches.

## Could not verify (yet)

- Whether `Pagy::Calendar.localize_with_rails_i18n_gem` is ever called with request input in real
  applications; the route is a public API at the pinned commit and is treated as a real route.
- Whether a solver would consider the thread-local route in scope; the instruction's property says
  "however the value reaches the library", and the design rules accept routes where the protection
  never existed.

## Out of scope (not built on)

- `Pagy.sync` copies caller-named resources to a caller destination (different protected outcome).
- `Pagy::Request` coerces page/limit URL params with `to_s.to_i` (different protection).

## Verification performed

### Behavioural probes on the pinned tree (before the task was built)

All with harmless markers under a temporary directory and the real library entry points:

- T1 setter + translate returned a marker dictionary from outside the configured directory.
- T2 direct per-request storage write + translate returned the same marker.
- T4 calendar localization registered a path outside the fake dependency's `rails/locale` dir and
  the i18n backend loaded the marker (`LEAK-CALENDAR`).
- T5 `dev_tools(wand_scale: "1\"></script><script>alert(1)</script>")` produced a live script element.
- T6/T7 `series_nav(aria_label:/id:)` and `previous_tag(aria_label:)` produced an extra
  `data-pwn="1"` attribute.
- T3/T8 were confirmed after `environment/injection.patch` was applied (the injection only adds
  `dictionary_for` and the `title:` option).

### Local suite matrix (Ruby, exact hidden tests)

| variant | security failing | functional failing |
|---|---|---|
| pinned+injected (nop) | 12/12 | 0/90 |
| oracle | 0/12 | 0/90 |
| hardening | 0/12 | 0/90 |
| alt_fix | 0/12 | 0/90 |
| sf_miss_locale_read | 5 | 0 |
| sf_miss_threadlocal | 1 | 0 |
| sf_miss_dictionary | 1 | 0 |
| sf_miss_calendar | 1 | 0 |
| sf_miss_devtools | 1 | 0 |
| sf_miss_navattr | 3 | 0 |
| sf_miss_infotitle | 2 | 0 |
| sf_crash (crash_as_refusal) | 4 | 0 |
| sf_malformed (malformed_identity) | 1 | 0 |
| ff_overbroad (refuse_all) | 5 | 1 |
| ff_nil_raises (adjacent_api) | 0 | 1 |

### Project tests at the pinned commit

- `test/unit/pagy/modules/i18n/i18n_test.rb`: 13 cases, 0 failures (with the project's
  per-test locale reset).
- `test/unit/pagy/modules/abilities/configurable_test.rb`: 11 cases, 0 failures.
- `test/unit/pagy/modules/i18n/locales_test.rb`: 78 cases, 0 failures; shipped unchanged as the
  functional project test.
The pinned i18n/configurable test files themselves encode pre-fix expectations (`locale=` keeps an
arbitrary string; `data-scale` renders the raw integer), so they are verified at the pinned commit
but not shipped: the oracle changes those exact expectations, and the task's own functional tests
cover the same legitimate behaviour in a version-stable way.

### Gate stages

- static: PASSED (final artifacts).
- nop: PASSED (security 0/12, functional 90/90, reward 0.0).
- oracle: PASSED 3/3 (security 12/12, functional 90/90, reward 1.0, identical results).
- patches: PASSED 13/13 declared outcomes:
  `sf_miss_locale_read` 5 sec fail, `sf_miss_threadlocal` 1, `sf_miss_dictionary` 1,
  `sf_miss_calendar` 1, `sf_miss_devtools` 1, `sf_miss_navattr` 3, `sf_miss_infotitle` 2,
  `sf_crash` 4 (crash_as_refusal), `sf_malformed` 1 (malformed_identity), all with 0 functional
  failures; `ff_overbroad` 1 functional fail (refuse_all), `ff_nil_raises` 1 functional fail
  (adjacent_api); `hardening` and `alt_fix` both reward 1.0. `blind.patch` is written downstream.
- Two earlier nop attempts failed as infra while the image build resolved a native Minitest 6/prism
  dependency; the Dockerfiles now install the pure-Ruby gem set into Ruby's default gem directory.
- Final oracle/nop counts include the two coupled calendar functional tests added after the first
  oracle pass; the whole stage sequence was re-run on the frozen artifacts.
