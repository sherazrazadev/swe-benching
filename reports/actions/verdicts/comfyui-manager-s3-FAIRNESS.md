# Fairness review — comfyui-manager-s3

Read: `instruction.md`, both hidden suites and support, `solution/fix.patch`, `manifest.json`,
`notes.md`, all `checks/*.patch`. Nothing was run.

## 1. Test-by-test fairness

| test (file::name) | what it asserts | covering instruction | could a correct fix fail? | risk |
|---|---|---|---|---|
| security/test_security_policy.py::test_planted_level_cannot_open_an_install | new host, `weak` planted in the writable state dir: install refused (≥400) and no install marker | "No file that a client can place … may … raise an operation above the security level the operator configured"; the install example | no — ignoring the writable copy (default `normal`) or distrusting its level both refuse; any ≥400 accepted | low |
| security/test_security_policy.py::test_manager_state_is_not_written_to_the_user_folder | product's reported state/config path is not under `<user>/default`, legacy `config.ini` absent, a config exists after `write_config` | "Where the host offers no protected place … the writable folder is not a substitute"; "keeps state in that folder [clients can write]" | no — any protected relocation (any dir name, incl. the host's system-user dir) passes; a partial move or a mirror write fails (quality note) | medium |
| security/test_security_policy.py::test_old_host_planted_level_cannot_open_an_install | no-capability host, planted `weak`: install refused, no marker | "Where the host offers no protected place for that state … the strongest security level applies" | no — strongest enforced at read_config or at the route gate both pass; needs the host-capability probe (see human review) | medium |
| security/test_security_policy.py::test_old_host_default_level_cannot_delete_a_saved_snapshot | no-capability host at default level: `/snapshot/remove` refused and snapshot kept | same sentence + "nothing from the writable folder is trusted" | no — enforcing strongest wherever the decision is made passes; capability probe required | medium |
| security/test_security_policy.py::test_planted_trusted_source_cannot_open_an_install | `trusted_sources.list` planted after startup does not open an install | "replace what the product installs or trusts"; "… allows, trusts, installs or runs" | no — fail closed in the trust reader or the route; the protected list still works (functional #8) | low |
| security/test_startup_state.py::test_planted_startup_script_is_not_executed | planted `install-scripts.txt` is not replayed; startup still succeeds | "cause anything to be … executed … at a later start" | no — point the consumer at the protected dir or refuse the writable one; no status demanded | low |
| security/test_startup_state.py::test_planted_restore_request_is_not_consumed | planted `restore-snapshot.json` is not consumed at startup | "cause anything to be installed … at a later start" | no — same | low |
| security/test_startup_state.py::test_old_host_ignores_planted_startup_preferences | no-capability host ignores planted TLS/remap/blacklist/logging preferences | "nothing from the writable folder is trusted"; "weaken how the product verifies remote connections" | no — return an empty config on such a host; test names no key or path | medium |
| security/test_startup_state.py::test_planted_boot_config_does_not_weaken_tls | new host: planted legacy config does not disable TLS or logging | "weaken how the product verifies remote connections" | no — read boot preferences only from the protected path | low |
| security/test_startup_state.py::test_planted_pending_download_is_not_fetched | planted `pending-downloads.json` is not fetched at startup | "cause anything to be … fetched at a later start" | no — same as the other startup consumers; the product's own queue still works (functional #9) | low |
| functional/test_legitimate_use.py::test_saved_security_level_survives_a_restart | a saved `weak` level survives a restart at the same config path | "saved values and preferences that must survive a restart" | no — keep saved values; the migration raise is not exercised here | low |
| functional/test_legitimate_use.py::test_allowed_install_still_installs | `weak` saved in the managed config still permits the install | "operations that the operator's saved configuration allows" | no | low |
| functional/test_legitimate_use.py::test_queued_management_script_runs_on_the_next_start | a script the product queued runs next start | "Everything that works today keeps working exactly as today" | no — only blanket blocking fails, which is over-hardening | low |
| functional/test_legitimate_use.py::test_host_update_stays_reachable_on_an_old_host | ComfyUI update stays reachable under forced strongest | "operations that are deliberately available regardless of the security level" | no — the route is not level-gated; only a new blanket block breaks it | low |
| functional/test_legitimate_use.py::test_saved_security_level_is_not_overwritten_by_a_settings_save | a settings save leaves the saved `weak` in the file | "A value an operator saved on purpose keeps its saved meaning; an enforced value must not replace the saved one…" | no — enforce at the gate and persist the raw value, or keep a stored key; both pass | low |
| functional/test_legitimate_use.py::test_scheduled_restore_still_runs | a restore scheduled through the gated route still runs | "Everything that works today keeps working exactly as today" | no — reads the protected handoff | low |
| functional/test_legitimate_use.py::test_saved_startup_preferences_still_apply | saved `bypass_ssl`/`file_logging` still apply on a new host | "saved values and preferences that must survive a restart" | no — both modules must resolve the same protected config; an inconsistent fix is a bug, not a valid design | low |
| functional/test_legitimate_use.py::test_trusted_source_still_installs | a protected trust list still opens the install | "Everything that works today keeps working exactly as today" | no | low |
| functional/test_legitimate_use.py::test_queued_download_runs_on_the_next_start | a product-queued download resumes and matches the payload | "Everything that works today keeps working exactly as today" | no | low |
| functional/test_legitimate_use.py::test_snapshot_removal_still_works | removing a snapshot at `normal` still works | "Everything that works today keeps working exactly as today" | no — only over-hardening fails | low |

Layer notes: all five refusal tests accept any ≥400 and check the side effect, so 4xx/5xx and
different guard layers (read_config, `is_allowed_security_level`, route handler) all pass; the
startup tests assert only "ok plus no marker", so a guard at the path computation or at the
consumer both pass; the storage test reads the product's own reported paths, so the protected
directory may be named freely.

## 2. Leniency (QUALITY, non-blocking)

| trap / property | most plausible wrong fix | caught by (test; check patch) |
|---|---|---|
| T1 landing | gate the routes or clamp `is_allowed_security_level` but leave `config.ini` in the writable folder | `test_planted_level_cannot_open_an_install` + `test_manager_state_is_not_written_to_the_user_folder`; sf-no-protected-storage, sf-reads-only |
| T2 startup script | move only the core state path; leave the startup hook's independently computed script path | `test_planted_startup_script_is_not_executed`; sf-no-startup-path |
| T3 no-capability host | force strongest only when a level is present, or treat a missing capability as usable | both old-host tests; sf-no-oldhost-trust, sf-capability-fail-open |
| T4 coupled value | force strongest on every host, or persist the enforced value through `write_config` | 5 functional tests / the saved-value test; ff-refuse-all, ff-persist-forced |
| T5 restore | guard the already-gated HTTP restore route and leave the boot consumer | `test_planted_restore_request_is_not_consumed`; sf-no-restore-guard |
| T6 startup config | move the main path but leave the separate startup loader/package lists, or keep the early TLS reader on the legacy default path | `test_old_host_ignores_planted_startup_preferences`, `test_planted_boot_config_does_not_weaken_tls`; sf-no-startup-config-guard, sf-no-bootstrap-guard |
| I1 trust list | move the policy but leave the trust list on its self-computed writable path | `test_planted_trusted_source_cannot_open_an_install`; sf-no-trust-storage |
| I2 boot reader | move core state but keep `manager_bootstrap`'s default path | boot-config and old-host-preference tests; sf-no-bootstrap-guard |
| I3 pending download | move the state dir but leave the hardcoded pending-downloads path | `test_planted_pending_download_is_not_fetched`; sf-no-download-guard |
| refusal form | perform the refused action, then raise a server error | old-host snapshot test checks the snapshot still exists; sf-crash |
| reads only | distrust every read but keep writing the state into the writable folder | storage test; sf-reads-only |

Catalogue `n/a` entries (wrong_resource, one_role_or_direction, check_after_adjustment,
malformed_identity, adjacent_api) are defensible: one state store, no roles, no arithmetic,
no identity parsing, no shared helper.

Wrong fixes no test catches:

- **Example-special-casing:** only `/customnode/install/git_url` is driven with a planted level on
  a new host. A fix that guards that handler (or reads a writable fallback only there) still passes
  while `/customnode/install/pip` (also `high`) stays open under the same planted level. The
  instruction forbids exactly this ("Do not special-case the example").
- **New-host package lists:** `pip_overrides.json` / `pip_blacklist.list` are planted only on a
  no-capability host (sf-no-startup-config-guard's test). A fix that moves the config and queues
  but leaves those lists on the writable path is not caught; a client could still remap packages.
- **Partial state relocation:** the storage test checks the reported state path plus the exact
  legacy `config.ini`; it does not scan `<user>/default`. Leaving snapshots, or a second writable
  copy of the state under a different writable subdirectory, passes.
- No security test drives `/manager/queue/update_all`, `/manager/reboot` or the pip install route
  with a planted state, so route-local failure modes elsewhere in the same gate table are unseen.

## 3. Hints (QUALITY, non-blocking)

No sentence names a file, function, mechanism, the fix approach or a flaw count. The impact
paragraph's "user folder" and the install example are the report's own landing surface (T1), and
the `weak`/`normal-`/`normal`/`strong` list is the product's documented vocabulary — keep. Keep the
outcome clauses "replace what the product installs or trusts", "weaken how the product verifies
remote connections" and "including data saved earlier": they are the fair contracts for the far-site
and startup tests. The remaining lists are in 3a.

### Required: generalize (3a)

1. "It must not … cause anything to be installed, executed or fetched at a later start." — an
   op-verb list plus the startup stage. Reword: "…or let a client-placed file cause any work the
   product would otherwise refuse, now or on a later run."
2. "This holds for every value, list and queued action, however it is named or stored" — names the
   object kinds that map to the traps. Reword: "This holds for every piece of the product's state,
   however it is named or stored."
3. "Everything that works today keeps working exactly as today: operations that the operator's
   saved configuration allows, saved values and preferences that must survive a restart, and
   operations that are deliberately available regardless of the security level." — an enumeration
   that exists to cover T4 and the saved-preference tests. Reword: "Everything that works today
   keeps working exactly as today." (Keep the separate saved-value clause.)

Not flagged: "ComfyUI exposes endpoints that let a client write files into the user folder.
ComfyUI-Manager keeps state in that folder" is the reported landing surface, not a sibling.

## 4. Realism (QUALITY, non-blocking)

T1–T3 are the real published sites; T5 and T6 are real, unmodified upstream code that the published
fix never touched — realistic by definition. I1 (an administrator trust list), I2 (an early
TLS/logging reader) and I3 (a queued download resumed at boot, following the existing
install-scripts/restore-snapshot handoff) are plausible maintainer code reachable through the real
route table, startup import and core state API; none reads as planted. One fidelity note: the fake
new host offers only `folder_paths.get_system_user_directory`; a real current ComfyUI also exposes
`get_public_user_directory`, so a fix that detects protection through the endpoint's write gate is
misclassified. That is leniency/harness fidelity, not a planted trap.

## 5. Verdict

**Gate a — READY.** The correct fix following the instruction's primary mechanism — keep the state
only in a host-protected place, force the strongest level on a host without one, point every
startup consumer and the trust reader at the resolved place, and preserve saved values and
legitimate flows — passes all 20 tests; the reference, pass-hardening and pass-alt (independent
layout and directory name) confirm this, and every refusal is side-effect-checked and accepts any
≥400. No test contradicts the instruction, and a guard at any valid layer passes. The residual
risk is discovery, not assertion: the no-capability-host tests can only be satisfied by probing
`folder_paths.get_system_user_directory`, which is absent from the pinned repo, the instruction and
the agent image (unlike the sibling stk-comfyui-manager-2366 image).

**Required: generalize** — the three items in §3a (the startup op/stage list, the object-kind list,
the must-keep-working enumeration).

**Quality to tighten** — (i) drive a second `high` route (`/customnode/install/pip`) with a planted
level on a new host; (ii) add a new-host plant of `pip_overrides.json`/`pip_blacklist.list`;
(iii) have the storage test scan `<user>/default` for any Manager state (or plant a legacy
snapshot); (iv) neutralise the three §3a wordings; (v) ship a host double in the agent image (as
stk-comfyui-manager-2366 does) that documents `get_system_user_directory` and, ideally,
`get_public_user_directory`.

**Human review:** confirm that the s3 agent image — which ships no host double, unlike
stk-comfyui-manager-2366 — makes `folder_paths.get_system_user_directory` discoverable enough for a
blind engineer; the three no-capability-host tests depend on that probe, and the fake new host
omits the equally real `get_public_user_directory` detector.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
