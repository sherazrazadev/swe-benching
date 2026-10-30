# lima-s4 — build notes

- Task: `lima-s4`; pattern A; track injected; builder `build-v1`.
- Advisory: GHSA-2J9V-P4XJ-CJW2 / CVE-2026-53657 / GO-2026-6230.
- Repo: lima-vm/lima. Pinned (vulnerable): `3d477e0cce94233b272553a7d5450d667a5f52e2`.
  Published fix: `b08cae8a670cf916d5da11c48a6de76dabd89678` (clean 3-file change; the
  `8a45892378d22f40505c31a38f786a07701b6d50` commit is the same change cherry-picked onto a
  branch with unrelated drift, so the clean diff is the oracle's base).
- Start UTC: 2026-10-30T17:56:32Z. End UTC: 2026-10-30T18:26:00Z.

## Security property (stated once, before routes)

The guest agent's control endpoint must be usable only by the instance's main user: no other
local user in the guest may reach or drive it, and the main user must keep being able to,
whatever mode or service manager starts the agent. An attempt by any other local user must
fail and have no effect.

This single property covers every tested route: the reported root daemon, every launcher that
starts it, the agent's unprivileged debug mode, and the injected legacy init route.

## The flaw, one line

`cmd/lima-guestagent/daemon_linux.go:141` chmods the root-run guest-agent UNIX socket to
`0777`, so every local guest user is authorised to a root gRPC agent (host-side port
forwarding / tunnel capability).

## Levers (each with a different reason a solver skips it)

T1 — main lever, how-type: coupled must-keep-working + producer off the check's path.
  Shape: a fix that only narrows the socket mode (or only handles the daemon) leaves the main
  user's forwarded client unable to connect, because the agent runs as root and the socket
  must be handed to the main user's uid. The uid has to be produced by the launch
  configuration (systemd unit generator, boot script) and consumed by the daemon; the daemon
  never calls those producers.
  Where: `cmd/lima-guestagent/daemon_linux.go:135-145`,
  `cmd/lima-guestagent/install_systemd_linux.go:110-131`.
  Reason to dismiss: the advisory's obvious fix is "chmod 0600"; the main user's ability to
  connect is forgotten, and the unit generator reads as plumbing, not as part of the security
  boundary.
  Coupled functional: main user reaches the agent through every launch route; an agent
  started with no main user still serves only root.

T2 — pattern A far site: the systemd install entry point and its unit generator.
  Shape: the main user's numeric uid must be carried from the boot-time installer into the
  generated unit's command line.
  Where: `cmd/lima-guestagent/install_systemd_linux.go:23-53`, `:110-131`;
  `pkg/cidata/cidata.TEMPLATE.d/boot.Linux/25-guestagent-base.sh:82`.
  Reason to dismiss: the unit generator is a serializer far from the socket; a fix that edits
  the daemon only, or the generator only, looks complete.
  `security_fail`: `sf-miss-systemd-producer.patch`, `sf-miss-systemd-call.patch`.

T3 — pattern A far site: the non-systemd (openrc) launcher branch in the shell boot template.
  Shape: the same uid, passed on the daemon command line rendered by the template.
  Where: `pkg/cidata/cidata.TEMPLATE.d/boot.Linux/25-guestagent-base.sh:54`.
  Reason to dismiss: a second init system in a shell heredoc, far from the Go sink; reads as
  non-default plumbing.
  `security_fail`: `sf-miss-openrc.patch`.

T4 — injected sibling I1, route where the protection never existed: legacy SysV-style init
  launcher branch in the same boot template (no openrc, no systemd).
  Shape: installs and starts a plain init script that runs the agent without carrying the main
  user's uid; on the injected baseline the socket is world-usable.
  Where: `pkg/cidata/cidata.TEMPLATE.d/boot.Linux/25-guestagent-base.sh` (new `elif` branch,
  placed before the existing systemd call; the published fix never touches it).
  Reason to dismiss: an unsupported/legacy distro path; "the guest agent needs systemd".
  Coupled functional: the legacy route still installs, starts and serves the main user.
  `security_fail`: `sf-miss-sysv.patch`.

T5 — injected sibling I2, how-type/second listener branch: the agent's unprivileged debug mode
  has its own unix-listener branch with its own `0777` chmod.
  Shape: a non-root start of the agent in debug mode serves the socket to every local user.
  Where: `cmd/lima-guestagent/daemon_linux.go` (new rootless branch; the published fix's hunks
  do not touch it).
  Reason to dismiss: "the agent must run as root"; a debug/non-production mode reads as out of
  scope.
  Coupled functional: the debug mode still starts and serves the main user.
  `security_fail`: `sf-miss-rootless.patch`.

T6 — input shape (sink, no owner): owner absent or 0 means the main user is root.
  Shape: the launcher faithfully passes the main user's uid 0; a "compatibility" fix that
  falls back to `0777` when no owner is present fails open.
  Where: `cmd/lima-guestagent/daemon_linux.go:135-145` through the systemd route with
  `LIMA_CIDATA_UID=0`, and a direct daemon start with no owner.
  Reason to dismiss: root-only is "no main user to restrict to", so the old mode is kept.
  `security_fail`: `sf-fail-open.patch` (catalogue `missing_authority`),
  `sf-wrong-object.patch` (catalogue `wrong_resource`).

The wrong fixes that miss a lever fail a **security** test because every route's security test
contains its own positive control: the main user must be served *and* the other local user must
not be. A chmod-only or missing-launcher fix therefore fails the positive control (it locks the
main user out), while an over-broad fix fails the functional group.

## Candidate sibling sites/routes found (full list), and why the picks won

Real, unmodified upstream:
1. `daemon_linux.go:141` chmod 0777 (the sink) — published fix site, not a sibling.
2. `daemon_linux.go:56-59` daemon flags (no owner input) — published fix site.
3. `install_systemd_linux.go:23-53,110-131` install-systemd flag/action/unit generator —
   published fix site; used as far site T2 (producer off the check path).
4. `25-guestagent-base.sh:54` openrc command args — published fix site; far site T3.
5. `25-guestagent-base.sh:82` systemd install call — published fix site; far site T2.
6. `pkg/hostagent/hostagent.go:712-713` host-side forward — coupled behaviour only, not a sink
   in the guest and outside the advisory's guest-side protection; not tested as a route.
7. `cmd/limactl/guest-install.go` copies a new agent binary but never restarts or re-renders a
   service, so it does not reach the socket; not a route.
8. `pkg/cidata/cidata.TEMPLATE.d/boot.sh:103` runs `lima-guestagent yq` as root for provisioning;
   a different command, no socket; not a route.
9. vsock / virtio listener branches (`daemon_linux.go:121-134`) — no UNIX socket and no
   filesystem permission to set; protected by the CID filter / device node; not routes for this
   property (kept as a functional preservation case).
10. `install_systemd` "unit already up-to-date" restart path — an old unit without an owner
    locks the main user out (availability), not an LPE; not a security sibling.
11. Darwin-only `fake_cloud_init_darwin.go` / `pkg/guestpatch/macos` — not reachable in the
    Linux test environment; out of scope.

Injected candidates considered:
A. Legacy SysV/no-service-manager launcher branch in the boot template — **picked (T4)**: a
   genuine route where the protection never existed, far from the Go sink, plausible (the
   script already branches per init system), and testable through the real boot entry point.
B. Unprivileged debug-mode listener branch in the daemon — **picked (T5)**: a second listener
   branch copying the chmod pattern (the screener's O8b shape); dismissible as non-production;
   testable without root, and its own chmod line survives the published fix.
C. A second Go service-definition generator (`install-openrc`/`install-init`) — rejected:
   duplicates route A's concept (more routes of one concept) unless it is the same route,
   and adds a new CLI surface that reads as a planted gadget.
D. A fallback unix socket when `/run` cannot be written — rejected: not reachable without mount
   tricks (the daemon runs as root and removes the path first); a trigger would have to be
   planted, which the rules forbid.
E. A systemd ExecStartPost/`chmod 0777` workaround — rejected: it reads as a deliberately
   insecure gadget, and a minimal systemd emulator would have to implement ExecStartPost just
   for it.
F. The host-side forwarded `ga.sock` mode — rejected: host users are outside the advisory's
   guest-side protection.
G. Deleting/renaming the legacy user unit — not a socket route.

Picks: T4 (A) and T5 (B), with different reasons to skip (legacy distro path vs non-production
mode) and different mechanisms (route where protection never existed vs second listener copy).

## Sites, routes and input shapes the security tests cover

- systemd boot route, main user uid 1000 (T1/T2/T3).
- openrc boot route, main user uid 1000 (T3).
- legacy SysV boot route, main user uid 1000 (T4).
- unprivileged debug mode, main user uid 1000 (T5).
- direct agent start with no owner: main user root (T6).
- systemd boot route with main user uid 0 (T6, owner absent/0 shape).

Each test drives the real entry point (the boot script as cloud-init runs it, the daemon CLI, or
the generated unit/init script), starts the agent, proves the main user is served (positive
control) and proves a different local user is not.

## Test architecture (verified experimentally in scratch Docker)

- The agent is built from the submission (`go build ./cmd/lima-guestagent`).
- The systemd/openrc/SysV routes are driven by running the product's own boot script inside a
  minimal chroot with stubbed `sudo`/`systemctl`/`rc-service`, then executing the unit /
  rendered init script. `Environment=`/`EnvironmentFile=` and `/etc/conf.d`/`/etc/default`
  sources are honoured, so the carrier of the main uid is the solver's choice.
- A fake `/proc/self/exe` in the jail makes the product's `os.Executable()` work for
  `install-systemd`; the jail uses bash + GNU coreutils (busybox ash resolves bare commands
  through `/proc/self/exe` and must not be used together with the fake link).
- The daemon runs as root inside the chroot (it refuses otherwise); the chroot has no access
  to `/tests` or `/logs`.
- "Usable by a user" is probed by connecting as that uid and sending the HTTP/2 client preface,
  then requiring a server byte; this accepts any correct protection (filesystem permissions or
  an in-agent peer-credential check) and rejects the vulnerable world-accessible socket.
- Rootless mode runs as uid 1000 directly (no chroot needed).
- Verified in scratch: pinned 0777 serves uid 1000 and 1001; fixed 0600 owned by 1000 serves
  1000 and denies 1001; placeholder `--socket-owner 0` gives 0600 root; boot-script systemd and
  openrc rendering both work in the jail with bash+coreutils+fake proc.

## What I could not verify

- total repo source size / tiny-vs-giant classification was not measured.
- current upstream (latest) still contains the flaw: not checked (no released tree supplied).
- Darwin/FreeBSD launch paths: not exercised (Linux-only task).
- The exact behavior of real systemd/openrc on a host: emulated in a jail from the product's
  own generated configuration; a fix that relies on a service-manager feature the emulator does
  not implement could be judged unfairly (documented in the fairness review).
- No trials were run (not permitted); the bar is a design claim, not measured.

## Local verification (before the gate)

- Both task images were built locally from the task's Dockerfiles. The agent image is the
  pinned commit plus `environment/injection.patch`, its `.git` is a fresh "Starting project"
  commit, the two injected mechanisms are present, and no `socket-owner` text exists in it.
- Hidden suites, run against a locally built injected binary and a locally built oracle binary:
  injected 6/6 security fail + 8/8 functional pass; oracle 6/6 + 8/8 pass.
- The project's own tests (`./pkg/cidata/...`, `./pkg/guestagent/...`) pass on the injected and
  oracle trees, including as uid 1000 (the `sockets` integration test does not skip).
- Check patches (applied with `patch -p1` to the injected tree, each rebuilt and run):
  sf-miss-sink 5 security fail / 0 functional fail; sf-chmod-only 4/0; sf-miss-rootless 1/0;
  sf-miss-openrc 1/0; sf-miss-systemd-producer 1/0; sf-miss-systemd-call 1/0; sf-miss-sysv 1/0;
  sf-fail-open 2/0; sf-wrong-object 5/0; ff-require-owner 2 security fail / 1 functional fail;
  ff-vsock 0 security fail / 2 functional fail; pass-hardening 6/6 + 8/8; pass-alt 6/6 + 8/8.
  The alternative fix carries the owner in the environment instead of the command line, which
  shows the suites accept a second design.
- The `go test ... | go-junit-report` pipeline used by the verifier was exercised on the
  project tests (23 testcases in `pkg/cidata` alone, no skips).
- Scratch experiments confirmed the mechanics before the harness existed: the pinned daemon
  creates a 0777 root socket and serves uids 1000/1001; the published-style fix creates a 0600
  socket owned by 1000, serves 1000 and denies 1001; owner 0 gives a 0600 root socket; and the
  product boot script renders and runs under both the openrc and systemd branches inside a
  bash+coreutils chroot.

## Gate (build-v1, 2026-10-30)

- static: PASS (strict; only the harness-produced blind patch and FAIRNESS.md remain absent, as
  expected at this stage).
- nop: PASS — on the pinned+injected tree all 6 security tests fail and all 41 functional tests
  pass (8 hidden + 33 project).
- oracle: PASS — 3 runs, reward 1.0 each, identical security (6/6) and functional (41/41).
- patches: PASS — 13/13 as declared: 9 security_fail (each leaves exactly its intended lever
  failing and zero functional failures), 2 functional_fail, pass-hardening 1.0, pass-alt 1.0.

## Pattern B register

No row was appended: the screener's O8 is empty, and a search of the tree found no unmodified
upstream route into this sink that the published fix leaves open. All tested routes are
published-fix sites or the two injected siblings. The host-side forwarded socket
(`pkg/hostagent/hostagent.go`) is a different object on the host side and outside this
advisory's guest-side protection.

## Out of scope

`pkg/portfwdserver` dials addresses supplied over the gRPC stream (a capability of the
protected sink, not this advisory); the host-side `ga.sock` relies on the instance dir being
0700; the `website/.../internals.md` note about the qemu virtio port looks stale. None was
pursued or built on.

