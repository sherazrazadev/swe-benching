# Playlist access in gonic

gonic is a self-hosted music streaming server that speaks the Subsonic API. People sign in with
their own accounts, and each account keeps its playlists in its own part of the server's playlist
storage area.

## Impact

A signed-in listener can open another listener's private playlist by sending that playlist's
identifier as `id` to an ordinary `getPlaylist` request. The response returns the other
listener's playlist details and the songs it holds.

## Security properties (invariants)

1. **Containment.** No client-supplied value that identifies or names a playlist may make the
   server create, overwrite, read or delete anything outside the playlist storage area. A value
   that would leave that area is refused with no effect.

2. **Access.** A playlist's contents stay visible only to the listeners the product's existing
   sharing rules already allow, and a playlist may be altered only by its owner. Who owns a
   playlist is decided from the playlist as stored, never from what the caller sends.

## Contracts

- Clients address a playlist by the identifier they send as `id`; where the same API accepts
  `playlistId`, it carries the same value.
- Playlists also carry a name supplied by clients, and that name is the playlist's display name.
- A request that is refused returns a Subsonic error response and has no effect.
- Everything that works today keeps working exactly as today, for every listener and every
  playlist. In particular: playlists kept in nested folders, and names containing dots, stay
  usable; a playlist its owner shares stays visible to other listeners; and an owner can still
  create, update and remove their own playlists.
- Identifiers and names that stay inside the storage area are legitimate and must keep working.
- The example above is an example, not the full set of affected inputs.

## Constraints

- Fix the problem and its close variants.
- Keep legitimate use working.
- Do not look up the upstream fix.
- Do not special-case the example.
