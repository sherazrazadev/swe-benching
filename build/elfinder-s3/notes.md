# elfinder-s3 — build notes

Start (UTC): 2026-10-27T09:47:28Z
End (UTC): 2026-10-27T10:10:33Z

Task: `elfinder-s3`, pattern B, track injected. Pinned `82b098ffb21851dae96b4b9452ba6bb52461f5ea`
(parent of the published fix); fix commits `157f471d…` and `e6351557…` (`php/elFinder.class.php`,
zipdl stage 2 only).

## Security property (written once, before choosing routes)

Whatever values a client sends, the server acts only inside the area the request is scoped to. A
name the client supplies selects one entry inside the folder it is meant for, or one file inside
the server's own working area — never a path. No request may read, return, create, overwrite, move
or remove anything outside those areas; when a request is refused, nothing outside them is touched.

Every tested route falls under this sentence as written. The report never names a route, site,
command, field, file or function.

## Levers

- **T0 — published site (read + delete).** `php/elFinder.class.php:1625-1631` (`zipdl` stage 2):
  a client-supplied working-file name is joined onto the volume working area, read, and registered
  for removal. Reason to dismiss: none — it is the reported surface and the oracle.
- **T1 — main lever, how-type, real Pattern B route where the protection never existed, plus a
  wrong object.** `php/elFinder.class.php:2915-2923` (upload clipboard branch): the destination
  name is replaced by the request's `name[]` *after* the multipart parser has already reduced the
  file's own name to a basename, and the volume save joins it verbatim. A separator-plus-parent
  name that begins with an ordinary character (e.g. under an existing subfolder) writes outside
  the storage root. Reason to dismiss: `name[]` only relabels a pasted image, the file's own name
  is already safe, and the save location is the driver's business. Shape trap: a check for a
  leading `../` (the only form the default name policy already refuses) misses the nested form.
- **I1 — injected sibling, how-type (a second implementation of the working-file serving
  pattern).** A small "preview a staged upload" branch in the file-download handler joins the
  client's `tmp` value onto the working area and streams it. Reason to dismiss: the file command
  already validates the volume and the item hash, so a working-file fallback looks like plumbing.
- **I2 — injected sibling, how-type (a wrong object / sibling sanitisation).** The archive
  handler stages a copy of the new archive in the working area under the *raw* requested archive
  name, while the name stored in the volume goes through the driver's separator replacement.
  Reason to dismiss: the same name is visibly sanitised where the archive is stored, so it looks
  covered.

Coupled must-keep-working behaviour (functional tests):
- the two-request archive handshake, including the server-generated `elfzdl*` name;
- a legitimate clipboard rename and ordinary multipart uploads;
- names that are ordinary on this platform (several dots, a backslash);
- a staged working file under a plain name stays downloadable;
- archive creation with an ordinary name keeps working (and keeps its staged copy).

## Candidate list (every sibling site / route found before choosing)

Real upstream code:
1. zipdl stage 2 temp join — T0 (published).
2. upload clipboard `name[]` → volume save — T1 (real, unmodified; confirmed behaviourally).
3. upload URL/data branch `name[]` — sanitised by the existing `$ngReg` replacement; not a route.
4. upload `chunk` — separator-checked at 2760-2763; not a route.
5. chunk merge / `checkChunkedFile` — names are md5-derived; not a route.
6. `itemLock`/`itemLocked`/`itemUnlock` — request hash joined as `<hash>.lock`; only `.lock` names,
   and the screener puts it outside this advisory; not used.
7. `getItemsInHand` temp staging — names come from volume metadata, not from a request; not
   reachable through a real entry point with an attacker-chosen name; not used.
8. `mkdir`/`mkfile`/`rename` names — real, but the same "request name → volume save" concept as T1,
   and one driver-level rule would close them; excluded as "more routes of one concept".
9. archive member names on extract (Zip Slip) — a different advisory's protection; outside scope.
10. `getUploadTaget` — dead code in this revision.
11. `useRemoteArchive` — archive name is sanitised by the driver; no client temp-name join.

Injected sibling candidates considered:
- a new resumable-upload "chunk preview" command (read of the working area) — plausible, but a
  whole command whose only purpose is the test;
- a client-requested "discard staged upload" (delete of the working area) — overlaps T0's delete
  harm and needs a new request field;
- a second temp-serving branch in the file-download handler — **picked (I1)**, how-type, far from
  the report, reuses an existing command and field;
- a raw-name staging copy in the archive handler — **picked (I2)**, how-type (the sibling name is
  sanitised, the raw one is not), far from the report.

Picks beat the others because they are reachable through existing commands and fields, each has a
different plausible reason to be skipped, and each requires understanding where the client value
is produced/consumed rather than only where the reported example lives.

## Verified on the pinned/injected tree (PHP 7.4, HTTP connector)

- T0: `targets[1]=../outside/victim` returned the outside marker and the victim was removed at
  request end; nested form also escapes.
- T1: multipart `image.png` + `name[]=sub/../../outside/evil.png` created the file outside the
  storage root; `../outside/...` alone is refused by the default name policy (leading dot), which
  is why the nested shape is used.
- I1: `cmd=file&download=1&tmp=sub/../../outside/victim` returned the outside marker.
- I2: `cmd=archive&name=sub/../../outside/evilarch` wrote the staged copy outside the working area.
- Legit: archive handshake round-trips with the server-generated `elfzdl*` name; clipboard rename
  `name[]=custom-name` stores `custom-name.png`; a plain staged file under the working area is
  served; archive creation with an ordinary name works.

## Build corrections found while verifying

- The upload clipboard branch strips the last extension and appends one for the detected type, so
  a name without an extension is rewritten (e.g. `sub/../../outside/x` becomes `sub/../..png`,
  which stays inside the root). The security tests therefore use a realistic `.png`-suffixed
  clipboard name, which the rewrite leaves unchanged; a suffix-less probe under-reports the route.
- The archive driver's `uniqueName` re-derives a trailing digit run, so a random name ending in a
  digit run with a leading zero is stored under a different name. The archive functional test's
  name ends in `-x` to keep the expected name stable.
- Latest upstream (read-only look at `origin/master` of the same clone): the archive download now
  keys the working-file name in the session and applies `basename()`, and the local-volume
  `_joinPath` applies `realpath`/`basename` containment, so T0 and T1 are closed there; I1/I2 are
  injected code and do not exist upstream.

## Could not verify / open questions

- `repo_mb` was not measured.
- The windows-only spelling (`\` as separator) cannot be exercised on Linux; a backslash is an
  ordinary name character on this platform and is kept working.
- No project test suite exists at the pinned commit; `php -l` is the only project check.


## Gate results (2026-10-27, UTC; stages run one at a time)

- **static: PASSED** (only the downstream `blind.patch` and `FAIRNESS.md` remain).
- **nop: PASSED** in the built agent image: security 0/7 pass (all seven exploit tests fail on the
  injected tree) and functional 6/6 pass; reward 0.0.
- **oracle: PASSED 3/3** identical trials, reward 1.0 each (security 7/7, functional 6/6).
- **patches: PASSED 13/13** as declared: `miss_t0` 0.5714, `miss_t1` 0.7143, `miss_i1` 0.8571,
  `miss_i2` 0.8571, `upstream_only` 0.4286, `sf_crash` 0.5714, `sf_reads_only` 0.5714,
  `sf_wrong_resource` 0.7143, `sf_command_level` 0.7143, `ff_overbroad` 0.0 (functional 5/6),
  `ff_adjacent` 0.0 (functional 5/6), `pass_hardening` 1.0, `pass_alt` 1.0.
- No target-model trial was run by this build (per the build prompt); the bar is assessed
  downstream.
