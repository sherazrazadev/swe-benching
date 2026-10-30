# Parked tasks

Tasks where both models failed every graded run and the fairness review passed, held by the owner for a later
decision (accept or reject). Each entry has what the fairness review said and how the runs failed.
The decision is recorded on the task's results branch as `build/<slug>/HUMAN-DECISION.md` (`DECISION: PARK`).
To decide later: change it to `KEEP` (accept) or `DROP` (reject) and re-run `verdict.yml` for the slug and run.

| Task | Weakness | Language | Project | DeepSeek | MiMo | Parked |
|---|---|---|---|---|---|---|
| [`izpack-zip-path-inj`](#izpack-zip-path-inj) | CWE-22 (path traversal) | Java | izpack/izpack | 0.8571, 0.8571, 0.8571 | 0.5714, 0.8571, 0.7857 | 2026-10-30 |
| [`mesop-s4`](#mesop-s4) | CWE-117 / terminal escape injection into logs | Python | google/mesop | 0.7436, 0.7436, 0.7436 | 0.7436, 0, 0 | 2026-10-30 |

---

## `izpack-zip-path-inj`

- **Results branch:** [`runs/41048153995`](https://github.com/sherazrazadev/swe-benching/tree/runs/41048153995) (task in `tasks/izpack-zip-path-inj/`, records in `build/izpack-zip-path-inj/`).
- **The bug (as the instruction states it):** the installer toolkit accepts a target location containing a
  parent-directory segment (`..`) from installer data, and running the installer creates a file outside the
  installation directory the user chose. The rule covers every location the installer creates, writes, moves,
  renames, rewrites or deletes, wherever the value entered the toolkit; `..` counts with either separator.
- **Fairness review:** READY (gate a). Open questions answered: a use-site check is required (values from
  installer variables never pass the metadata loader); the unpacker result is the "installation failure" surface;
  the writer's boolean/catch path is the product's refusal form.
- **How the runs failed:** all 36 functional tests pass in every run.
  - DeepSeek r1-r3 (0.8571 each) fail only `refusesForwardSlashTraversal` and `refusesBackslashTraversal`: a file
    entry built directly through the public API with a `..` target is not refused. The models guard where files are
    added to a pack, not the entry itself. This is one of the task's original routes and is covered by "may not be
    retained … however it enters the toolkit".
  - MiMo r1 (0.5714) also misses the uninstaller-output and install-log locations; r2/r3 similar to DeepSeek.
- **Caveats:** five repair rounds (instruction scope, a test that planted values before setup, a writer fixture that
  failed setter-side refusals, a separator sentence). Along the way six config-step tests were removed as out of
  scope; under the spec's "variants beyond the PoC" they could have stayed, so this version is somewhat easier than it
  could be. No Claude audit or blind check was run on this version.

## `mesop-s4`

- **Results branch:** [`runs/41048108098`](https://github.com/sherazrazadev/swe-benching/tree/runs/41048108098) (task in `tasks/mesop-s4/`, records in `build/mesop-s4/`).
- **The bug (as the instruction states it):** values a client sends (reported via the CSP report endpoint) are
  written to the server console / log with escape sequences and control characters intact. The property covers
  "every value a request carries … no matter how that value reaches the output"; a request rejected because of
  client input must get a 4xx, not surface as an unhandled server error.
- **Fairness review:** READY (gate a). Open question (asset-route 4xx; keeping the warning's own colour) — the 4xx
  follows from the stated refusal contract.
- **How the runs failed:**
  - DeepSeek r1-r3 and MiMo r1 (0.7436 each) pass all 11 functional tests and fail the same 10 security tests: the
    same attack through a second real upstream route, requests for web-component files with a bad path or file
    extension (`GET /__web-components-module__/…`), which raises a 500 whose Flask log line carries the raw bytes.
    The tests accept escaping, stripping or refusing. DeepSeek saw the leak but left the route; MiMo cleaned the
    message but kept the 500.
  - MiMo r2/r3 (0): additionally broke the functional test `test_warning_keeps_its_own_marker` (the app's own
    coloured warning marker), and still missed 10-15 security tests, so they fail either way.
- **Caveats:** this one route carries 10 of the 39 security tests (about 26 % of the security score). The
  colour-marker functional test decided the 0 for MiMo r2/r3 (an earlier note on the results branch said otherwise;
  that was wrong). No Claude audit or blind check was run.
