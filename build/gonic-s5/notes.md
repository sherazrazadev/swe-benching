# gonic-s5 — build notes

## Window

- Start (UTC): 2026-10-28T20:34:03Z
- End (UTC): pending

## Advisory and pin

- Advisory: GHSA-2FP4-5V5C-4448 / CVE-2026-49339 / GO-2026-5825 (sentriz/gonic); path traversal
  (CWE-22) in the playlist `id` enabling cross-user playlist access (CWE-639).
- Pinned (vulnerable) commit: `37090aa71c5e0bb7a322313fc8622c828fd9916b` (parent of the first
  published fix).
- Published fixes: `6dd71e6a3c966867ef8c900d359a7df75789f410` (ownership on getPlaylist /
  deletePlaylist) and `0824bed88f6bbc490ba28bf09d28e5dfeb07b445` (containment in the store,
  identity from the resolved path, create/update load condition). Neither fix's regression tests
  are in the pinned tree.
- Pattern: A+B. Track: injected. Reuses the verified mechanism inventory of `stk-gonic-15195`
  (same pin), which passed the full gate on 2026-10-26, and adds two injected siblings.

## Security property (written once, over the protected data)

1. **Containment.** No client-supplied value that identifies or names a playlist may make the
   server create, overwrite, read or delete anything outside the playlist storage area. An
   identifier that would leave the area resolves inside it, or the request is refused.
2. **Access.** A playlist's contents stay visible only to the listeners the product's existing
   sharing rules allow, and a playlist may be altered only by its owner. Who owns a playlist is
   decided from the playlist as stored, never from what the caller sends.

These two properties cover every lever below; no route has a sentence of its own. Property 1
covers the identifier (all real sites, the cover-art route, the injected cover upload, the
injected duplicate source) and the name (the injected duplicate destination) because it speaks
about what "identifies or names a playlist". Property 2 covers the ownership levers.

## Levers (one line each)

- **T1 cover-art route** (real, Pattern B, how-type: protection never existed): the playlist
  cover-art lookup rebuilds the playlist directory from the raw decoded identifier outside the
  store — `server/ctrlsubsonic/handlers_raw.go:243-270`. Reason to dismiss: it is the image
  endpoint, not a playlist read, and the published fix never touches it.
- **T2 create/update ownership load** (real, published-fix far site, how-type): the load
  condition is inverted (`err != nil && pl != nil`), so the guard at the next line sees a zero
  playlist and never fires — `server/ctrlsubsonic/handlers_playlist.go:79`. Reason to dismiss:
  the guard is visibly present.
- **T3 store containment with coupled nested layout** (real, published-fix far site, how-type):
  the store joins whatever relative path it is handed in Read/Write/Delete —
  `playlist/playlist.go:95,153,206`. Reason to dismiss: a handler-level denial looks sufficient;
  the store looks like a dumb filesystem API. Coupled value: the documented nested
  `<user>/**/<name>.m3u` layout.
- **T4 identity from the caller's spelling** (real, published-fix far site, how-type shape): the
  owner is parsed from the raw relative path while the file operation uses the cleaned path, so
  `2/../1/x.m3u` reports owner 2 — `playlist/playlist.go:108,209-220`. Reason to dismiss: the
  first path element is the user id for ordinary identifiers, and a containment fix accepts the
  aliased form.
- **T5 read ownership** (advisory route): the read route has no ownership decision —
  `server/ctrlsubsonic/handlers_playlist.go:51-60`. Coupled value: shared playlists stay
  readable by other listeners.
- **T6 delete ownership** (advisory route): delete hands the decoded identifier to the store with
  no ownership decision — `server/ctrlsubsonic/handlers_playlist.go:177-187`.
- **S1 injected: playlist cover upload** (`injected`): a new authenticated route stores a
  client-supplied image next to the playlist, building the directory from the raw decoded
  identifier the same way the cover-art lookup does; it never goes through the store. Realistic:
  gonic already serves a playlist cover from a directory it builds this way, and an upload is the
  obvious sibling feature. Reason to differ from T1: it is a write (the observable is a created
  file), so fixing the read path does not cover it; and it is "only an image".
- **S2 injected: playlist duplicate** (`injected`): a new authenticated route copies an existing
  playlist to a new name supplied by the client; the destination path joins that name into the
  storage tree without containment. Realistic: a duplicate/copy feature is the natural companion
  of create, and the code reuses the store's path spelling. Reason to dismiss: the source was
  already read and authorised, and the new name reads as a display label.

## Every candidate sibling site/route found before choosing

1. `server/ctrlsubsonic/handlers_raw.go:243-270` — playlist cover-art lookup builds the directory
   from the decoded identifier (real upstream, published fix untouched). **Chosen (T1).**
2. `server/ctrlsubsonic/handlers_playlist.go:196-199` — `playlistIDDecode` hands a decoded
   identifier to any caller; a handler that builds a path from it is the same pattern.
   **Chosen as the basis of S1.**
3. `playlist/playlist.go:201-207` — a Rename/Copy/Stat added next to Delete would join the
   caller's path. **Chosen as the basis of S2 (Duplicate).**
4. `db/migrations.go:503-554` — the m3u migration builds a store and writes by generated path.
   Rejected: not reachable through the HTTP entry point; a hidden test cannot drive it without
   reaching into startup, and the paths it uses are server-generated (`NewPath`), not
   client-supplied.
5. `playlist/playlist.go:137-140` — relative item lines inside a playlist are resolved against
   the playlist's directory. Rejected: a different protection (playlist *contents* pointing at
   music), not the containment property; the screener also left it out of scope.
6. `playlist.Store.BasePath()` exposure (used by coverForPlaylist) — a handler that uses it
   directly bypasses the store. This is the mechanism behind S1; no separate route.
7. `server/ctrlsubsonic/handlers_raw.go:87-155` — `coverForArtist` fetches a remote image URL
   (SSRF class). Rejected: unrelated protection; outside this advisory.
8. `coverCacheFilename` / cover cache paths — the cache key is the base64 identifier, which has
   no path separators. Rejected: no reachable escape.
9. `ServeStream` / `download` — resolves ids through the database (`specidpaths.Locate`), not
   playlist paths. Rejected: no playlist identifier reaches a filesystem path there.
10. `playlist.NewPath` and the empty-id create branch — the name is passed through
    `fileutil.Safe` and the path is `<user>/<safe>-<millis>.m3u`. Rejected: already contained;
    it is a must-keep-working value instead.
11. `Store.List` — paths come from walking the storage area, never from the client. Rejected.
12. `ServeUpdatePlaylist` `songIndexToRemove` slice-bounds panic and `playlistIDDecode` ignoring
    the base64 error — rejected: unrelated to containment/ownership (noted outside scope).

**Why the two picks beat the rest:** S1 and S2 are the only candidates that (a) are reachable
through the real authenticated HTTP API, (b) fall literally under property 1, (c) sit where
neither published fix touches, and (d) need a *different* piece of reasoning than the real
levers: S1 is a second, write-side implementation of the playlist-directory construction that the
store fix cannot reach; S2 is a shape trap where the identifier is in-base but a *name* becomes
the destination path. Both are how-type at the point that matters (the mechanism, not merely a
second call site), and each has a different dismissal (an image endpoint; a display label).

## Sites, routes, input shapes the security tests cover

- Real sites: store Read/Write/Delete; owner identity in Read; create/update ownership load;
  read ownership; delete ownership; playlist cover-art lookup.
- Injected sites: playlist cover upload; playlist duplicate (destination name and source
  identifier).
- Shapes: identifier whose cleaned path leaves the storage area (read/write/delete/cover/upload);
  identifier that stays inside but aliases another user's directory (`2/../1/x.m3u`); public
  playlist readable by a non-owner; foreign private playlist refused; foreign replacement and
  delete refused; duplicate destination name with `..`; duplicate source identifier outside the
  area.
- Legitimate shapes kept: owner reads/updates/deletes own playlist; another listener reads a
  public playlist; create without an identifier; nested dotted paths readable and cover served;
  owner uploads a cover and reads it back; owner duplicates with a dotted name.

## Coupled must-keep-working behaviour

- Nested `<user>/**/<name>.m3u` paths and names containing dots (T3, T1, S1, S2).
- Public playlists readable by other listeners (T5).
- Owner create/update/delete and the project's golden tests (T2, T5, T6).
- Cover art of a nested playlist served (T1) and a cover uploaded by the owner served (S1).
- Duplicate of a dotted name readable by its owner under the caller's directory (S2).

## What was verified (local, Go 1.26.3, module go 1.26)

- Every mechanism reproduces through the product's real `ctrlsubsonic.New` mux and login
  middleware: cover-art escape serves an outside image; read/create/delete with an escaping
  identifier reach outside the storage area; an aliased update rewrites another user's playlist;
  the read route returns a private playlist to another listener; delete removes another user's
  playlist; the injected cover upload creates a file outside the storage area; the injected
  duplicate writes outside it via a `..` name.
- Local matrix (security / functional): nop 0/11, 7/7; oracle 11/11, 7/7; miss_cover 10/11
  (cover art); miss_create_load 10/11 (foreign replacement); miss_containment 8/11
  (read/create/delete outside); miss_identity 10/11 (aliased); miss_read_owner 10/11 (foreign
  read); sf_reads_only 9/11 (foreign replacement + foreign delete); miss_injected_cover 10/11
  (cover upload); miss_injected_duplicate 10/11 (duplicate name); upstream_fix 8/11 (cover art +
  both injected); ff_refuse_all functional fails; ff_nested functional fails (nested paths);
  pass_alt 11/11, 7/7; pass_hardening 11/11, 7/7.
- The project's own tests (`./playlist ./fileutil ./server/ctrlsubsonic`) pass on the
  pinned+injected tree and on the oracle.
- A clean simulation of the image (base + `environment/inject.patch`) followed by
  `solution/solve.sh` reproduces the verified oracle tree exactly (`diff -rq` clean).
- The pinned tree does not contain the advisory's regression tests (`TestGetPlaylistDeniesOtherUsersPrivate`,
  `TestDeletePlaylistDeniesOtherUsers` are added only by the first fix commit).
- The injected operations' attacks were shown to be blocked by the oracle's injected fixes and to
  leave ordinary cover upload / duplicate (nested, dotted names) working.

## Gate

- static: PASS (2026-10-28T20:46Z)
- nop: PASS (security 0/11; functional 171/171 — 7 hidden + 164 project), 2026-10-28T20:54Z
- oracle: PASS (3 runs, reward 1.0, identical), 2026-10-28T20:56Z
- patches: PASS (13 checks: 8 security_fail on exactly their lever, upstream_fix security_fail,
  2 functional_fail, pass_alt and pass_hardening at reward 1.0), 2026-10-28T21:03Z
- The blind patch is declared in the manifest but not written here (left for the post-build
  blindfix step); FAIRNESS.md is written after the trial.

## Window end

- End (UTC): 2026-10-28T21:04Z

## Outside scope (not built on)

- Relative item lines in an m3u resolving against the playlist directory (different protection).
- `ServeUpdatePlaylist` slice-bounds panic for a hostile `songIndexToRemove` (unrelated).
- `coverForArtist` remote image fetch (SSRF class, unrelated).
