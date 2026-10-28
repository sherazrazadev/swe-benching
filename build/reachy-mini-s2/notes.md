# reachy-mini-s2 build notes

- Start: 2026-10-28T03:40Z
- End: 2026-10-28T04:12Z (static, nop, oracle x3 and patches all passed)

## Task shape

Pinned commit `376024b8`, published fix `984c7723` (sound-upload allow-list, body-size middleware,
GStreamer content probe). The vulnerable image is the pinned tree plus `environment/injection.patch`
(a sound-pack router with archive and bulk routes, mounted from `create_app`). `solution/fix.patch`
is the published source change (minus the example CLI) extended to the chunked audio sink and the
injected routes.

Property in `instruction.md`, stated once: whatever a client supplies that the daemon stores on
disk, however it arrives, must be a complete playable audio stream, stored under a recognised
audio extension and no larger than 25 MiB; otherwise the request is refused and the filesystem is
left as it was.

## Levers

- **T1 (A, where): reported HTTP upload.** `src/reachy_mini/daemon/app/routers/media.py:147-175`
  writes the client name and body after only a basename check. Reason to dismiss: none; this is the
  report and the positive control.
- **T2 (B, how — main lever): chunked command-channel sink.** `src/reachy_mini/daemon/backend/
  abstract.py:1575-1612` base64-decodes `upload_audio_*` chunks and writes bytes to
  `<temp>/reachy-mini-uploads/audio/<id>.wav` with no content probe and no byte cap. The SDK
  websocket (`io/ws_server.py:145-171` -> `Backend.process_command`) and the WebRTC data channel
  (`abstract.py:2097-2111`) both reach it; the published HTTP middleware is never on either path.
  Reason to dismiss: it is the recorded-move audio attachment, a different feature from sound
  upload, the name is forced to `.wav`, and peers look trusted. Fix needs the sink and both
  transports understood, not just the reported handler.
- **T3 (B, how): the body's declared length is not the only shape.** The pinned handler reads the
  whole body in one call (`media.py:160-175`), so an absent or understated `Content-Length` is
  bounded only by the client. Reason to dismiss: the size cap looks covered once the honest
  `Content-Length` fast path exists.
- **T4 (injected, how): archive import.** `src/reachy_mini/daemon/app/routers/sound_packs.py:33-76`
  extracts every zip member into the sound directory. Reason to dismiss: the outer object is an
  archive, so an audio check "does not apply"; a check on the archive never inspects its members.
- **T5 (injected, where/how): bulk multipart import.** `sound_packs.py:79-100` loops over uploaded
  files. Reason to dismiss: a convenience route, each file small, and the ASGI cap is keyed on one
  exact path.

Coupled must-keep-working behaviour: genuine WAV/OGG/FLAC/MP3 uploads, case-insensitive
extensions, same-name replacement, directory-prefix basenames, a legitimate file just under the
limit, and valid chunked audio (including a non-WAV container) stored and replaced in place. An
over-broad `.wav`-only fix fails three functional tests; a refuse-all fix fails thirteen.

## Candidate list (full) and picks

Real write sinks found by searching `UploadFile`, `open(..., "wb")`, `extractall`, `mkstemp`,
multipart routes and client dispatch:

- `media.py` sounds upload — picked T1 (report).
- `abstract.py` `_handle_audio_finish` via SDK websocket — picked T2.
- the same sink via the WebRTC data-channel dispatcher — picked T2 (second transport; a fix in the
  websocket layer alone leaves it open).
- `upload_id` interpolated into the destination path (`abstract.py:1594-1596`) — **not built on**:
  it is a path-traversal protection (CWE-22), a different protection from this advisory's
  content/size validation; noted as outside scope.
- move-upload assembly — in-memory only, no disk write; not a candidate.
- `utils/rerun.py` temp URDF and `apps/fork_conversation.py` copytree — server-generated paths, not
  client-supplied bytes; not candidates.
- `POST /api/apps/install-private-space` and `POST /api/media/play_sound` — adjacent code-install
  and untrusted-path-decoding surfaces, no client-byte write; noted as outside scope.

Injected candidates considered (O8b leads plus own search):

- archive import route — **picked T4**: nested content cannot be handled by validating the outer
  upload, and the import reads as a distinct feature.
- bulk multipart route — **picked T5**: outside the exact-path body cap and outside the singular
  handler's validation.
- base64 JSON preset route — rejected: base64 is an encoded form of the same payload, and counting
  decoded bytes against a wire-body cap introduces an ambiguity in the 25 MiB contract.
- a legacy alias route for the singular upload — rejected: another route of one concept.
- a wake-sound upload in the audio-config router — rejected: it duplicates the bulk multipart shape
  and stretches the audio-config router beyond this advisory's file-write protection.
- a persisted move upload — rejected: the project deliberately keeps parsed moves in memory;
  adding a disk write would be a new subsystem, not a plausible maintainer gap.

T2 beat the where-only candidates because it is real upstream code the published fix never
touches, is reached from two transports, and needs sink-level validation plus the coupled playback
behaviour understood. T4 beat the other injected candidates because it is the only one whose
payload is nested, so a check at the visible boundary provably cannot cover it.

## Verified

- On the pinned tree plus injection: the reported upload stores `setup.sh`; the SDK websocket and
  WebRTC handler each store a marker payload as `*.wav`; an honest 26 MiB body, a streamed body
  with no length and a streamed body with an understated length are all stored; archive and bulk
  routes store dangerous names and partial packs.
- On the reference fix: 21/21 security tests pass, 13/13 hidden functional tests pass, 33/33
  project tests pass. On the vulnerable tree: 21/21 security tests fail, all 46 functional tests
  pass.
- Gate: static pass; nop pass (21 security failing, 46 functional passing); oracle 3/3 reward 1.0;
  every declared patch behaved as declared (5 security_fail levers, 2 functional_fail, hardening
  and alternative both 1.0).
- Read-only look at current upstream `main`: the reported endpoint still has the published
  allow-list/probe/size fix; `_handle_audio_finish` still writes decoded client bytes without a
  content probe (a wire-size cap was added later); the websocket and WebRTC dispatchers still
  exist.

## Could not verify

- The target-model bar: no trials or target models were run, per the build instructions.
- Whether a real ASGI server rejects duplicate/conflicting `Content-Length` headers; the tests use
  one absent and one understated header, not duplicates.
- Whether any branch other than current `main` validates the chunked sink's content; `main` does
  not.

## Fairness notes

- The 25 MiB cap on the chunked sink rests on the instruction's "one stored file" and "however it
  arrives"; the protocol's own 256 MB wire allowance does not conflict because the property is
  about the stored file.
- The injected routes are not named in the instruction; they are found by searching client-to-disk
  writes, and both fall under the same one-sentence property.
- Content validation can use GStreamer (present in both images) or a structural check; the
  alternative patch proves a second design passes.

## Out of scope, noted only

- `upload_id` path traversal in the chunked sink (CWE-22) — different protection, not built on.
- `POST /api/apps/install-private-space` (code installation) — not built on.
- `POST /api/media/play_sound` with an absolute daemon path — decoding surface, not the write sink.
