# lima-s4 — pre-trial fairness review

The solver sees only `instruction.md` + the repo. All 14 hidden tests and the project tests
(`pkg/cidata`, `pkg/guestagent`) are graded; reward is 1.0 only if every one passes.

## 1. Test-by-test fairness

The covering sentence is the task's one general property: *"The agent's control endpoint must be
usable only by the instance's main user: no other local account may reach or drive it, and the
instance's main user must keep being able to reach it"*, plus *"Fix the problem and its close
variants wherever the agent's control endpoint is made reachable."* Read literally it applies to
every route driven below; no route-specific sentence is required.

| Test (file::name) | Asserts | Covering instruction | Could a correct fix fail? | Risk |
|---|---|---|---|---|
| run_security.py::test_sec_systemd_install_route_only_main_user | boot install OK; systemd route serves uid 1000, denies 1001 | property; "The instance's main user is served normally"; "whatever starts the agent" | no — natural fix (carry uid into unit, chown, 0600) passes; unit-only hook not run by emulator (Ø†) | medium |
| run_security.py::test_sec_openrc_boot_route_only_main_user | openrc install writes init.d; serves 1000, denies 1001 | property; "wherever … made reachable" | no (Ø†) | low |
| run_security.py::test_sec_legacy_init_route_only_main_user | legacy install writes init.d; serves 1000, denies 1001 | property; "wherever … made reachable" | no (Ø†) | low |
| run_security.py::test_sec_unprivileged_mode_only_main_user | unprivileged mode serves its user, denies 1001 | property; "whatever privileges the agent runs with" | no — 0600 as running uid / euid fallback (Ø†) | low |
| run_security.py::test_sec_agent_started_without_owner_serves_root_only | no owner: root served, 1000/1001 denied | "An agent started with no main user (that is, as root) … serving root and no other account" | no (Ø†) | low |
| run_security.py::test_sec_systemd_route_with_root_as_main_user_only_root | root main user: root served, others denied | same contract; "main user is served normally" | no (Ø†) | low |
| run_functional.py::test_func_agent_without_owner_still_serves_root | root served | same contract | no | low |
| run_functional.py::test_func_unprivileged_mode_still_serves_its_user | running user served | property; "Keep every legitimate use working" | no | low |
| run_functional.py::test_func_two_main_user_clients_are_served | two sequential clients served | "served normally"; "Everything that works today keeps working" | no | low |
| run_functional.py::test_func_boot_install_is_repeatable | repeat boot OK; init script byte-identical | "repeating the installation is harmless" | no | low |
| run_functional.py::test_func_systemd_keeps_vsock_transport | unit carries `--vsock-port 5000` | "a non-UNIX transport such as vsock … still receives that setting" | no | low |
| run_functional.py::test_func_systemd_keeps_virtio_transport | unit carries `--virtio-port <value>` | same | no | low |
| run_functional.py::test_func_systemd_keeps_runtime_directory | ExecStart keeps `--runtime-dir /run/lima-guestagent` | "the configured runtime state directory is still honoured" | no | low |
| run_functional.py::test_func_openrc_keeps_vsock_transport | script + conf.d carry vsock | same contract | no | low |

Ø† Denial is `EACCES`/`EPERM`/closed connection; any server byte counts as "served". An
accept-then-reject RPC-level guard sends HTTP/2 SETTINGS, so it does not satisfy "may not reach"
(transport-level) and is not the primary mechanism. A unit-only hook (`ExecStartPost=`/`UMask=`) is
not run by the emulator, but a unit-only fix is not a complete fix either.
S1–S6 below are the six security rows above, in order; F1–F8 the eight functional rows.

## 2. Leniency (quality)

| Trap / property | Most plausible wrong fix | Caught? |
|---|---|---|
| property: only the main user | hardcode owner `1000`, allow only root+1000, or deny only `1001` | **No test** — every route uses MAIN_UID=1000 / OTHER_UID=1001, and the jail's copied `/etc/passwd` makes uid 1000 the only human account |
| T1 reported sink | `chmod 0600` only (`sf-chmod-only.patch`) | Yes — positive control fails S1/S2/S3 |
| T2 unit producer | daemon-only fix (`sf-miss-systemd-producer.patch`) | Yes — S1 |
| T3 boot systemd call | generator-only fix (`sf-miss-systemd-call.patch`) | Yes — S1 |
| T4 openrc | systemd-route-only fix (`sf-miss-openrc.patch`) | Yes — S2 |
| T5 legacy init | supported-init-only fix (`sf-miss-sysv.patch`) | Yes — S3 |
| T6 unprivileged listener | root-branch-only fix (`sf-miss-rootless.patch`) | Yes — S4 |
| T7 no-owner / root | fail-open when owner==0 (`sf-fail-open.patch`); wrong object (`sf-wrong-object.patch`) | Yes — S5/S6; S1–S6 respectively |
| property (over-broad) | remove the endpoint/feature | Yes — positive controls + F1–F8 |

Uncaught wrong fixes: (a) hardcoded uid(s); (b) a listener that serves one connection then exits —
only F3 (rootless) opens two connections, so S1–S6 and F1–F4 pass; (c) guessing the owner from
`/etc/passwd` (1000 happens to be correct).

## 3. Hints (quality)

- "whatever starts the agent and whatever privileges the agent runs with" — variant list.
- "the agent is installed and started automatically when the instance starts" — stage words.
- "repeating the installation is harmless" — stage.
- "the configured runtime state directory is still honoured" — setting.
- "a non-UNIX transport such as vsock or virtio still receives that transport setting" — variant list.
- "the host reaches it through a forwarded local endpoint and uses it for port forwarding" — channel/list.
- "It reaches the agent's control endpoint the same way the host does" — channel.
- "An agent started with no main user (that is, as root)" — input shape.
- "an instance whose main user is root is ordinary" — input shape; duplicates the property.

## Required: generalize (step 3a)

1. "whatever starts the agent and whatever privileges the agent runs with" → "in every configuration."
2. "the agent is installed and started automatically when the instance starts" → "the agent is set
   up automatically when the instance starts."
3. "repeating the installation is harmless" → "repeating the setup is harmless."
4. "the configured runtime state directory is still honoured" → "every configured launch setting is
   still honoured."
5. "a non-UNIX transport such as vsock or virtio still receives that transport setting" → "an agent
   configured for another transport still receives its setting."
6. "the host reaches it through a forwarded local endpoint and uses it for port forwarding and other
   privileged operations" → "the host uses it for privileged operations."
7. "It reaches the agent's control endpoint the same way the host does" → drop.
8. "An agent started with no main user (that is, as root)" → "An agent with no configured main user
   must serve only the account it runs as."
9. "an instance whose main user is root is ordinary" → drop; the property covers it.

## 4. Realism

T1–T4, T7: real upstream code, reachable via the real entry points (boot script, generated
unit/init, daemon CLI). T5 (legacy init) and T6 (unprivileged listener) are injected but
maintainer-plausible per-init-system fallback and debug-listener copy, with no deceptive names. The
sysv sha256/pidfile machinery is mildly more than needed but ordinary shell. The jail stubs execute
the product's own generated definitions; the ExecStart-only emulation is the one fidelity gap (Ø†).

## Quality to tighten

- Add a route run with main_uid ≠ 1000 (e.g. 2000) and a third other uid (1002), so hardcoded or
  guessed owners fail.
- Add a second main-user connection to a root/systemd route (F3 covers only rootless) to catch a
  one-shot listener.
- Require refusal before the endpoint serves a byte (or accept an HTTP/2-level rejection) to remove
  the per-RPC-layer ambiguity.
- Execute a minimal `ExecStartPost`/`UMask` in the systemd emulator, or state generally that the
  protection must live in the agent and launch configurations, not service-manager directives.
- Apply the step-3/3a rewording.

## Verdict

READY. Every hidden test is covered by the general property read literally. A correct fix following
its primary mechanism — restrict the socket to the main user's uid (chown + owner-only mode), carry
that uid from every launcher, euid fallback in unprivileged mode, root-only when no owner — passes
all 14; the oracle (3×1.0) and the independent blind patch confirm. There is no instruction/test
contradiction, no undeducible assertion and no impossible spec. The alternative-layer risks
(per-RPC guard, systemd-only hook) are not the stated mechanism; they are quality/harness caveats,
not unfairness.

Human review: confirm (a) that a per-RPC peer-credential guard leaving HTTP/2 SETTINGS on the wire
is properly outside "may not reach", and (b) that the ExecStart-only systemd emulator is acceptable.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
