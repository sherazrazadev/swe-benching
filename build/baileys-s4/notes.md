# baileys-s4 build notes

- Started (UTC): 2026-10-30T07:36:00Z
- Ended (UTC): 2026-10-30T08:25:02Z

## Host / commit
- Repo: whiskeysockets/baileys
- Advisory: GHSA-QVV5-JQ5G-4CGG / CVE-2026-48063 (origin validation of control-plane protocol messages).
- Pinned: 28ca087cf1cbe3c05a5b704d67b3e2270d647b74 (direct parent of the published fix 3beb08eecf; the
  fix touches only `src/Utils/process-message.ts` and adds no tests).
- Pattern B, injected track.

## General security property (written once, before routes)
A message sent by anyone other than the account must never change client state that only the
account's own devices are allowed to change: history-sync progress/completion and the status the
client reports, stored app-state sync keys, identity mappings between a contact's addresses, stored
account settings, and the message store the account is supposed to have asked for. It holds however
the control payload is delivered or wrapped. Own-device control messages and the control messages
other users are legitimately allowed to send (deletes, edits, disappearing-setting changes, label
changes) must keep working exactly as today.

Every route, shape and injected sibling below falls under that sentence. The instruction never names
a route, file or type.

## Levers (one line each)
- T1 main lever, Pattern B "protection never existed" (how-type): the inbound-sync bookkeeping in
  `src/Socket/chats.ts:1219-1301` (status/completion, `shouldProcessHistoryMsg`, the state machine)
  runs by reading the history notification straight off the incoming message and never checks its
  origin; the published fix only returns early inside `processMessage`, after this already ran.
  Reason to dismiss: "the payload itself is dropped in the dispatcher, so this is only flush /
  status bookkeeping".
- T2 shape trap (how-type): the dispatcher normalises the content (`normalizeMessageContent`) before
  it sees the protocol message; a plausible guard placed on the raw `message.message.protocolMessage`
  misses a control message nested in `ephemeralMessage` / `viewOnceMessage` /
  `documentWithCaptionMessage` / `editedMessage` (`src/Utils/process-message.ts:322,331`).
  Reason to dismiss: the report's example is a plain protocol message, so a raw check looks complete.
- T3 injected sibling (where-type, far): `src/Socket/chats.ts` pre-persists app-state sync keys from
  an `appStateSyncKeyShare` before the dispatcher runs; a non-self sender's key is stored even when
  the dispatcher later refuses it. Reason to dismiss: "cache warm-up; the dispatcher validates it".
- T4 injected sibling (where-type, outside the published type set): `src/Utils/process-message.ts`
  handles `INITIAL_SECURITY_NOTIFICATION_SETTING_SYNC` (an own-device account-setting sync) and
  writes the setting for any sender; the published fix's four-type list does not include it.
  Reason to dismiss: not one of the four types named in the (unseen) upstream guard, and it looks
  like a settings update rather than sync state.
- Coupled must-keep-working (functional): REVOKE, MESSAGE_EDIT, EPHEMERAL_SETTING,
  GROUP_MEMBER_LABEL_CHANGE from other users, reactions from other users, and every own-device
  control message above.

## Injected siblings: full candidate list, then the picks
Candidates found (screener O8/O8b + own search):
1. `src/Socket/chats.ts:1219-1301` history-sync bookkeeping (real upstream, O8) - PICKED as T1.
2. `src/Socket/chats.ts:1324-1327` app-state resync triggered by a key share while Syncing (real,
   O8). Not built: reaching Syncing starts `resyncAppState`, which retries a mocked query forever;
   no offline behavioural test can observe it without inventing a fake server. Gate still guards it.
3. `src/Socket/messages-recv.ts:511-529` newsletter plaintext -> `upsertMessage` (real). Not a
   sibling: it reaches the same dispatcher, so the published guard covers it.
4. `src/Socket/messages-recv.ts:1604-1618` LID-PN mapping + `migrateSession` from the envelope
   `participantAlt` (real). Out of scope: not protocol-message-driven (screener O8b-5); not pursued.
5. `src/Socket/messages-recv.ts:406-431` mex linked-profile mappings (real). Out of scope: server
   notification, not a protocol message.
6. `process-message.ts` PDO response branch (published type) - already in the guard; using it as a
   sibling would only repeat the published concept.
7. process-message APP_STATE_SYNC_KEY_SHARE branch - same.
8. Newsletter plaintext path (O8b-3) - same dispatcher; dropped.
9. `chats.ts` app-state key pre-persist - PICKED as T3 (plausible eager write before the buffer
   releases; far from the report; covered by "stored app-state sync keys").
10. `process-message.ts` INITIAL_SECURITY_NOTIFICATION_SETTING_SYNC - PICKED as T4 (real proto type,
    plausible feature a maintainer would add, outside the published four-type list).
Picks beat the rest because they are reachable through the real inbound path, are not duplicates of
the published dispatcher, sit in files the published fix never touches, and each has a different
dismissal (bookkeeping vs cache warm-up vs a settings update).

## Verified on the pinned/injected copy (local jest, not Docker)
- Injected tree: 12/12 security fail; 10/10 functional pass; 35/35 project area tests pass.
- Oracle tree (published guard generalised to the fifth type + origin gates in the sync bookkeeping
  and the eager key write): 12/12 security pass, 10/10 functional pass.
- Checks patches (all generated against the injected tree):
  sf-miss-history: 4 security fail / functional pass; sf-raw-content: 4 security fail / functional
  pass; sf-miss-security-setting: 1/0; sf-miss-eager-key: 1/0; sf-published-types-only: 6/0;
  sf-wrong-resource: 12/0; ff-refuse-all: 5 security fail and 5 functional fail;
  alt-allowlist: 12/12 + 10/10; harden-defensive: 12/12 + 10/10.
- Mechanism one-liners only; exploit detail is not written down.

## Fairness / unknowns
- Test entry: the library's real socket (`makeWASocket`) on a stubbed websocket, delivering inbound
  messages through the socket's own inbound processing entry (`sock.upsertMessage`, what
  `messages-recv` calls for every message). No network, no crypto.
- Toolchain quirk: at the pinned commit `generics.ts` uses the `Long` type without importing it; the
  full `tsc` program resolves the UMD global, but ts-jest's per-file compile does not. The grading
  config runs ts-jest with `diagnostics: false` (transpile-only), so the project's own area tests
  pass unchanged. Product source is not modified for this.
- Unknown: `present_in_latest` was checked read-only against the clone's `origin/master`; master
  still has the published guard in the dispatcher and still has no origin check in the history
  bookkeeping, so T1 is recorded `yes`. The master tree is newer than the pinned commit and was not
  otherwise analysed.
- Gate results (Docker, after the final layout): static PASSED; nop PASSED (12/12 security fail on
  the vulnerable copy, all functional + 35 project tests pass); oracle PASSED (3 runs, reward 1.0,
  identical); patches PASSED (all nine declared checks behave as declared; the blind patch is
  written later by the blind-fix step).
- Verified the published fix adds no tests between the pinned and fix commits (`git show --stat`).
