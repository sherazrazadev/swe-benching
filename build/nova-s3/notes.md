# nova-s3 build notes

- Start UTC: 2026-10-27T09:48:18Z (driver start; this session began 09:48Z)
- Task: `nova-s3`, pattern A, track `injected`
- Repo: openstack/nova, pinned `d335457f48d09c3d780c92413fe777030c1335e2`
  (2012-07-02). Published fixes: `2427d4a99bed` (Folsom), `b0feaffdb2b1`
  (Essex backport), `ce4b2e27be45` / `d9577ce9f266` (CVE-2012-3447 refinement:
  canonicalise as root). Advisory GHSA-cm54-3vvf-f5p8 /
  GHSA-xc4g-7vw8-924h (CVE-2012-3361 / CVE-2012-3360).

## Design (written before building)

One property, stated once in the report, over the protected outcome:

> Nova must never create, overwrite, append to, truncate, change permissions
> or ownership of, or otherwise modify any file or directory outside the root
> of the filesystem it is injecting into - whatever the caller supplies and
> whatever the image already contains.

Every route and every sibling below falls under it literally.

### Entry points exercised

- `nova.virt.disk.api.inject_files(image, files)` - the personality path
  (`POST /servers` / rebuild personality) after the privileged loop mount is
  stubbed to a temp directory.
- `nova.virt.disk.api.inject_data(image, key, net, metadata, admin_password)`
  and its documented lower-level twin `inject_data_into_fs(...)` - the
  spawn-time injectables (same public library, other virt callers).

Both are public library APIs; the mount itself cannot run in a container, so
the tests stub only the mount (and `utils.execute`'s `run_as_root` wrapper),
and let every write happen for real on a temp tree.

### Levers

1. **L1 (main, how-type, pattern A far sites + shape).** The report lands on
   the request-supplied personality path (`_inject_file_into_fs`). The same
   module writes four more files with literal names, and the image itself is
   attacker-influenced, so a literal name still escapes through a symlink
   planted in the image. The check must be canonical (symlink-resolving), not
   lexical, and must cover every writer. Reason to dismiss: "only the
   personality path is user-supplied; the literal file names are safe".
   Shape traps: intermediate symlink, final-component symlink, and a target
   that only shares the mount root's name as a string prefix
   (`.../image` vs `.../imageX`), which a `startswith(fs)` check allows.
2. **L2 (coupled must-keep-working, how-type).** Appends must stay appends
   (existing SSH key material survives), overwrites must stay overwrites
   (no duplication), absolute paths and `..` segments that resolve inside
   must stay accepted, a symlink that resolves inside must stay writable,
   parent directories must still be created, and a request may still carry
   several files / a deep new path. Reason a solver skips it: "reject every
   `..` / every symlink, or send every write through one overwrite helper".
3. **L3 (injected sibling, how-type).** `_setup_selinux_for_keys(fs)` is a
   second write in the key-injection path, with a target chosen from the
   image (`etc/rc.local` vs `etc/rc.d/rc.local`) and append semantics. It is
   real code from a later upstream release, written in this tree's naive
   `utils.execute('tee', ...)` style. Reason to dismiss: "SELinux context
   housekeeping, not the injected payload".
4. **L4 (injected sibling, how-type / ordering).** The admin-password rewrite
   touches `etc/.pwd.lock` before the copy-back. A dangling symlink there
   creates a host file even if the later passwd/shadow paths are checked.
   Reason to dismiss: "an empty lock file cannot overwrite anything". The
   security test checks the side effect itself.

Not used: the CVE-2012-3447 root-privilege refinement cannot be tested at
uid 1000 (see "Could not verify"); the oracle keeps it for fidelity, and a
plain `os.path.realpath` fix also passes the tests (fair).

### Sites / routes covered by security tests

- personality traversal (`../outside/...`), prefix collision
  (`../imageX/...`), intermediate symlinked directory, final-component
  symlink;
- key injection with `root/.ssh` symlinked outside;
- network injection with `etc/network` symlinked outside;
- metadata injection with `meta.js` symlinked outside;
- admin password with `etc/shadow` symlinked outside;
- L3: `etc/rc.local` symlinked outside, and the `etc/rc.d` branch;
- L4: `etc/.pwd.lock` dangling symlink outside.

### Coupled functional behaviours

Absolute path, `..`-resolving-inside path, deep new directories, multiple
files, overwrite semantics, append semantics for keys, symlink-inside,
password rewrite preserving `passwd`, SELinux rc.local append.

## Injected-sibling candidate list (all found in the pinned tree)

Screener O8b leads plus my own search (`grep` for `tee`, `inject`, mount
roots):

1. `nova/virt/xenapi/vm_utils.py:1798-1814` mount-then-inject wrapper - it
   already calls `disk.inject_data_into_fs`, so the published fix covers it;
   a direct-write rewrite would be an invention and is reachable only through
   private XenAPI plumbing (not testable through the public injection API).
   **Not used.**
2. `nova/virt/libvirt/driver.py:1054-1058` `_inject_files` wrapper - delegates
   to `disk.inject_files`; a path check there is defence in depth, not a
   separate sink. **Not used.**
3. `nova/virt/disk/api.py:130-139` `bind()` - same `tee` idiom but writes a
   cgroup ACL file on the host, outside this advisory's protection; screener
   marks it out of scope. **Not used (out of scope note).**
4. `nova/virt/libvirt/driver.py:1005` `_enable_hairpin` - `tee` into sysfs,
   host interface names, not image injection. **Not used.**
5. `nova/virt/baremetal/proxy.py:474` - calls `disk.inject_data` (covered),
   and the call is broken at this commit. **Not used.**
6. SELinux key-context helper - present in the later upstream release
   (`_setup_selinux_for_keys`), absent here; adding it in this tree's naive
   style is a plausible backport and is a separate sink inside key
   injection. **Chosen (L3).**
7. Password lock file before the copy-back - plausible locking idiom, same
   module already uses `touch`; a side effect that precedes any later check.
   **Chosen (L4).**
8. A second `inject_data(files=...)` loop (added upstream later) - would
   share `_inject_file_into_fs`, so one fix covers it; not an independent
   sink. **Not used.**

L3 and L4 beat 6/7/8 because each is a distinct sink with a distinct reason
to dismiss, both are how-type, both sit far from the reported personality
path, and both are reachable through the same public injection API.

## Verified

- Pinned tree reproduces all nine security routes via the public API with a
  real write layer (symlink escapes for key/net/metadata/shadow, traversal,
  prefix collision, L3 rc.local and rc.d branch, L4 lock creation).
- Oracle (published fix + L3 + L4 fixes) refuses all of them and leaves the
  outside targets unchanged.
- All functional behaviours pass on both the pinned and the oracle tree.
- Project test `nova/tests/test_virt.py` (2 tests) passes in the probe image
  (python 2.7, Debian buster archive, 2012-era dependency pins).
- Pinned commit predates every regression test in the fix commits; the image
  contains no tests.

## Packaging deviations from the template

- `tests/test.sh` uses `setpriv --reuid=agent --regid=agent --clear-groups
  --no-new-privs` without `--inh-caps=-all --bounding-set=-all`: Debian
  buster's libcap-ng 0.7.9 cannot spell the "all" caps set ("libcap-ng is too
  old for 'all' caps"), so the template's exact array makes the verifier exit
  with `infra:no_results`. The runner still executes as uid 1000, with cleared
  groups and no-new-privs, so no submission code gains privilege.
- The verifier image installs `python3` (not `python3-minimal`) so score.py
  has the standard library (`json`).
- Debian buster's git 2.20 has no `git init -b`; the fresh baseline uses
  `git init -q && git symbolic-ref HEAD refs/heads/main`.

## Gate results

- `--only static`: PASS except the one allowed missing item, the `blind`
  pass patch (the pipeline writes it after the build). No leak, format,
  hidden-test, exact-status or catalogue problem.
- `--only nop`: PASS. 11 security tests all fail on the vulnerable tree;
  12 functional tests all pass.
- `--only oracle`: PASS. 3 runs, reward 1.0 each, identical results.
- `--only patches`: PASS. All 15 checks behave as declared: seven
  security_fail (1-9 security tests failing, zero functional), six
  functional_fail (1-12 functional failing), both pass patches 1.0.

End UTC: 2026-10-27T10:29:04Z

## Could not verify / open

- The published refinement (canonicalise as root so a symlink under a
  root-only directory is resolved) needs a privilege split the verifier
  (uid 1000) cannot create without user namespaces; it is in the oracle but
  is not a tested lever.
- `present_in_latest` for the register: current Nova no longer injects files
  this way, so the routes are answered from the pinned tree only.
- Full project test suite not run (2012 stack); only the affected-area test
  file, as allowed.
