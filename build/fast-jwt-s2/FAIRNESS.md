# fast-jwt-s2 — pre-trial fairness review

Instruction sentences referenced below (quoted verbatim):

- **G1**: "Key material must be used only as what it actually is: asymmetric material must never be used as, or accepted in place of, a shared symmetric secret…"
- **G2**: "…and no token may be accepted or produced unless its signature was created and checked with an algorithm that the configured material genuinely supports."
- **G3**: "This is a property of the material itself."
- **K1**: "Genuine material must keep working with the algorithms it supports, whatever text accompanies it, rather than merely being refused."
- **K2**: "An application that explicitly chooses a symmetric algorithm may use any string material as the shared secret for that choice. That choice is unchanged, and it does not make the material a secret for any other use."
- **K3**: "Everything else that works today keeps working exactly as today, for every kind of material and every way it can be supplied."
- **R1**: "A refusal is a clear error; no token is accepted and none is produced."

`helpers.expectRefused` accepts *any* throw, at construction or at verify time, so a guard at the dispatcher, the option builder or the detector all satisfy it; no error class or status is demanded.

## 1. Test fairness

| test (file::name) | what it asserts | covering sentence | could a correct fix fail it? | risk |
|---|---|---|---|---|
| verify_prefixed_keys::comment-line prefix | HS token forged with `<comment>+pubRsa` refused | G1, G3 | no — a correct detector refutes it (a fix that strips only reported prefixes is not correct) | low |
| verify_prefixed_keys::line comment | same, `//` prefix | G1 | no | low |
| verify_prefixed_keys::printable byte | same, `.` prefix | G1 | no | low |
| verify_prefixed_keys::HTTP header | same, HTTP header prefix | G1 | no | low |
| verify_prefixed_keys::control bytes | same for NUL/SOH/ESC/DEL | G1 | no | low |
| verify_prefixed_keys::zero-width chars | same for ZWSP/ZWJ/U+180E | G1 | no | low |
| verify_prefixed_keys::EC comment | same, EC public key | G1 | no | low |
| verify_prefixed_keys::Ed25519 comment | same, Ed public key | G1 | no | low |
| verify_prefixed_keys::private key comment | prefixed private key cannot verify | G2 (material supports no verifying-with-it use) | no | low |
| verify_prefixed_keys::junk PEM before key | key behind an unrelated PEM block refused | G1, G3 | no — skipping to the real header and refusing HS is also accepted | low |
| verify_prefixed_keys::buffer prefix | same via Buffer | K3 ("every way it can be supplied") | no | low |
| verify_prefixed_keys::mixed alg list | refused with `['HS256','RS256']` | K2 (a mixed list is not an explicit symmetric choice) | no | low |
| verify_prefixed_keys::async key fetcher | same via promise fetcher | K3, G1 | no | low |
| verify_prefixed_keys::HS384 | same with longer HMAC alg | G1, G2 | no | low |
| recognized_keys::RSA with surrounding text | prefixed RSA verifies its own RS256 token **and** refuses forged HS | K1, G2, G1 | no | low |
| recognized_keys::EC with surrounding text | same for EC | K1, G2, G1 | no | low |
| signer_prefixed_keys::prefixed private key | auto-detect yields RS256, token verifies | K1, G2 ("produced") | no | low |
| signer_prefixed_keys::prefixed public key refused | signer throws | G2 ("produced") | no | low |
| signer_prefixed_keys::control-byte public key | signer throws | G2 | no | low |
| signer_prefixed_keys::printable public key | signer throws | G2 | no | low |
| signer_prefixed_keys::async public key | async signer rejects | G2, K3 | no | low |
| signer_prefixed_keys::prefixed private key never HS | either throws or emits non-HS | G1, G2 | no — refusal form explicitly allowed | low |
| detection_cache::explicit-HS then auto | explicit HMAC works; later auto signer refuses | K2 ("does not make the material a secret for any other use") | no — a detector-only fix fails this, but such a fix contradicts K2 | low |
| detection_cache::explicit-HS with surrounding text | same | K2 | no | low |
| detection_cache::refusal then explicit-HS | cached refusal does not block the explicit choice | K2 ("may use any string material … for that choice") | no | low |
| key_ring::prefixed public key | key-ring entry not used as secret | G1, G3, K3 | no | low |
| key_ring::Buffer public key | same via Buffer entry | K3 | no | low |
| key_ring::prefixed certificate | same for certificate entry | G1, G2 | no | low |
| key_ring::prefixed EC key | same | G1 | no | low |
| certificate_chain::prefixed certificate | certificate entry not used as secret | G1, G2 | no | low |
| certificate_chain::unimportable certificate | garbage certificate block refused | G2 (material supports no algorithm, so no token may be accepted); G3 | no — borderline literal reading, see Human review | medium |
| hmac_use::all HMAC algorithms | HS256/384/512 round-trip | K3, K2 | no | low |
| hmac_use::buffer secret | Buffer secret round-trip | K3 | no | low |
| hmac_use::wrong secret | wrong secret refused | R1 | no | low |
| hmac_use::PEM-shaped explicit secret | explicit HS256 with PEM-shaped string works | K2 | no | low |
| hmac_use::PEM-shaped secret with surrounding text | same | K2 | no | low |
| asymmetric_use::all key types | auto-detect RS/ES/Ed and verify | K3, K1 | no | low |
| asymmetric_use::certificate verifies | cert verifies its key's token | K3, G2 | no | low |
| asymmetric_use::certificate with comment | prefixed cert keeps verifying | K1 | no | low |
| asymmetric_use::passphrase key | passphrase key signs | K3 | no | low |
| asymmetric_use::explicit asym algs | RS512/PS256 still work | K3 | no | low |
| certificate_use::chain | certificateChain verifies | K3 | no | low |
| certificate_use::buffer chain | same via Buffer entries | K3 | no | low |
| key_rotation_use::later public key | keyRing verifies with a later key | K3 | no | low |
| key_rotation_use::later secret | keyRing verifies with a later secret | K3 | no | low |
| key_rotation_use::none match | keyRing refuses an unverifiable token | R1, K3 | no | low |
| async_keys::secret fetcher | async key round-trip | K3 | no | low |
| async_keys::PEM fetcher | async PEM round-trip | K3 | no | low |
| async_keys::callback fetcher | callback-style fetcher | K3 | no | low |
| project/*.spec (259 upstream cases, visible in /workspace/test) | existing crypto/signer/verifier behaviour, incl. leading-whitespace and PEM-like-secret round-trips | K3, K2 | no — reference, alt and hardening patches all green; requirements visible in the repo | low |

## 2. Leniency (quality)

| property / trap | most plausible wrong fix | caught? |
|---|---|---|
| T1 verify detector | strip only the reported prefix / trim more aggressively | **yes** — verify_prefixed_keys control/zero-width/HTTP variants (`miss_base.patch`) |
| T1 | refuse everything that contains a PEM header (over-broad) | **yes** — recognized_keys + hmac_use 4–5 (`overbroad.patch`) |
| T2 signer detector | fix verification only | **yes** — signer_prefixed_keys (`miss_sign.patch`) |
| T3 memo | fix the detector, leave the memo | **yes** — detection_cache (`miss_cache.patch`) |
| T4 explicit choice / genuine keys | refuse genuine prefixed material | **yes** — recognized_keys, asymmetric_use cert-with-comment (`overbroad.patch`) |
| S1 key ring | keep the spelling heuristic | **yes** — key_ring (`miss_keyring.patch`) |
| S2 certificate chain | keep the fail-open fallback | **yes** — certificate_chain (`miss_certchain.patch`) |

Wrong fixes **no** test catches: a fixed prefix blacklist (`#`, `//`, `.`) — every tested prefix passes, any other byte fails; the `|| rest.algorithms` shortcut left in the key ring/certificate chain — no test passes `algorithms` to those options; special-casing the three key fixtures — undetectable.

## 3. Hints (quality)

- "The library chooses the algorithms from that material." → "Which algorithms are valid follows from the material."
- "whatever text accompanies it" → "Genuine material must keep working with the algorithms it supports rather than being refused."
- "…does not make the material a secret for any other use." → "The allowance is scoped to the operation that makes the choice." (Keep the scope; drop the cross-use phrasing.)
- "one example, not the whole problem" / "close variants" → "Fix the property, not the example."

## 3a. Required: generalize

None. No sentence names a file, function, option, route, sibling, stage or format; the material kinds and the accepted/produced outcomes are the property itself.

## 4. Realism (quality)

T1–T3 are unmodified upstream code reachable via `createSigner`/`createVerifier`. S1 (`keyRing`) and S2 (`certificateChain`) are plausible maintainer additions — a per-entry spelling heuristic and a migration fallback — documented and reachable. S2's fallback is the least likely but not contrived. Nothing planted.

## Verdict

**Gate a — READY.** Every assertion is G1/G2 read literally over key material, or K1–K3 preserving existing behaviour. The natural fix (classify by what the material is, refuse unsupported headers, recognise genuine material under surrounding text) passes all 31 security and 18 functional tests plus the 259 visible upstream cases; the reference, alternative and hardening patches all score 1.0. Other layers (dispatcher vs detector, refusal at construction vs verify time) pass because `expectRefused` accepts any throw. The only judgment is certificate_chain's unimportable-certificate case: G2 covers it only if such a block counts as material supporting no HMAC algorithm.

## Quality to tighten

- Add a novel prefix (`é`, `@`, a non-ASCII byte) before a public key and an EC key, killing the prefix-blacklist fix.
- Add `keyRing`/`certificateChain` cases with a mixed `algorithms` list to cover the leftover `|| rest.algorithms` shortcut.
- Apply the §3 rewordings.

Human review: confirm that an unimportable `-----BEGIN CERTIFICATE-----` block reads as "material that genuinely supports no algorithm" (G2), so certificate_chain's second test is fair rather than a new requirement.

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
