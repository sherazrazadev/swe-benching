# streamlit-s4 — build notes

- slug: `streamlit-s4`
- candidate: screener-v2 entry 5856 — GHSA-VQWP-45WM-R9R5 / CVE-2026-10804 /
  PYSEC-2026-212 (streamlit/streamlit, CWE-327, cache-key hash collision /
  incomplete input fingerprinting, data integrity)
- track: injected, pattern B
- started (UTC): 2026-10-30T11:29:28Z (pipeline start); design started 2026-10-30T11:35Z
- finished (UTC): 2026-10-30T12:02Z

## Verified before designing

- Pinned `4d2a62a151466f7dc2fb9d076092526c6b2aeec6` is the **parent** of the published fix
  `fec0f584dae9261abed16cad35b32922104bb933` (checked with `git cat-file -p`). The fix
  changes only `lib/streamlit/runtime/caching/hashing.py` (PIL branch) and adds
  `test_PIL_pmode_palette_collision_prevention` to `lib/tests/.../hashing_test.py`.
  The pinned tree does not contain that regression test; there is no other commit between
  pinned and fix.
- The flaw reproduces through the public entry point on the pinned tree: a
  `@st.cache_data` function called with two `Image.new("P", ...)` images that have the same
  `tobytes()` but different `putpalette()` tables computes only the first result and returns
  it for the second call (call counter stays at 1). Confirmed with a mock script-run context
  and a memory cache storage manager (the same setup the project's own cache tests use).
- Published-fix behaviour, measured on the pinned tree with the fix applied: small P-mode
  collision is closed; **PA mode still collides** (`mode == "P"` does not match `"PA"`);
  **large P images still collide** when the palette differs only at bytes the fixed-seed
  numpy sample does not select (the fix prepends the palette to the sampled array).
- The project's own `hashing_test.py` passes on the pinned tree (78 passed / 7 skipped with
  pytest 8.4.2 + pytest-benchmark 5.3.0 and `-o filterwarnings=`); it also passes with the
  reference fix applied.
- Current upstream (`develop`, read-only fetch on 2026-10-30) still has the published fix's
  `mode == "P"` check and still prepends the palette before sampling, so both real uncovered
  routes are present in latest. It also has a newer `runner.cacheHashSeed` option that does
  not exist at the pinned commit.

## Security property (stated once, general)

A cached function must never return a result that was computed from a different image.
Whenever two images render differently, the cache must treat them as different inputs.
This holds for every image a cached function receives, whatever its size or content.

Contracts stated once for the whole product:
- caching semantics stay: an equal input is still served from the cache (the body does not
  run again), and all public cache decorators keep working;
- cache identity is stable across processes, so a cache persisted to disk survives a
  restart;
- non-image argument values keep their existing hashing behaviour.

## Levers

1. **L_large (how-type: shape a plausible check mishandles; real upstream, Pattern B).**
   For an image whose byte buffer is large enough to be sampled, the natural fix (fold the
   colour table into the packed pixel array before the numpy sampling runs) can still lose
   the table: the fixed sample does not select every palette byte, so two large images that
   render differently can keep one cache entry. The robust fix hashes the colour table
   outside the sampled array.
   Site: `lib/streamlit/runtime/caching/hashing.py:539-547` (branch) +
   `hashing.py:525-537` (sampling). Reason to dismiss: sampling large inputs is a
   documented performance tradeoff and the palette is already "included", so the route
   reads as intentional. Present in latest: yes.
2. **L_pa (how-type: shape a plausible check mishandles; real upstream, Pattern B).**
   Palette-carrying images are not only mode `P`; mode `PA` (palette plus alpha) also stores
   colour in a table that `tobytes()` omits. A check written against the reported mode alone
   leaves `PA` colliding. The robust fix decides on the attached colour table, not a mode
   spelling.
   Site: `lib/streamlit/runtime/caching/hashing.py:539-547`. Reason to dismiss: the report
   says palette-indexed P images; `PA` is a rare mode that still allows alpha. Present in
   latest: yes.
3. **L_opened (where-type: injected sibling).**
   An extra dispatch arm for PIL plugin image classes (images returned by `Image.open`),
   which the exact `PIL.Image.Image` type check does not match, hashes only `tobytes()`
   so that file-backed images are cacheable at all. The published fix does not touch it.
   Site: injected in `lib/streamlit/runtime/caching/hashing.py` immediately before the
   existing image branch. Reason to dismiss: it is a compatibility arm for a different
   class ("makes opened images hashable"), and it does hash the image buffer.
   Real: no (injected); a maintainer adding support for lazily opened images could write it.
4. **L_stability (coupled must-keep-working, functional only).**
   The cache key must stay deterministic across processes because a disk-persisted cache
   file is named after it. A tempting over-broad repair of L_large is to randomise the
   sample seed; that makes a second process miss and recompute.
   Site: `lib/streamlit/runtime/caching/hashing.py` sampling; tested through
   `persist="disk"` across two processes.

Different dismissal reasons: 1 documented sampling tradeoff / "already included"; 2 the
reported mode (P) is not the only palette mode; 3 a different class / "it hashes the buffer";
4 over-hardening is safer.

## Candidate list (every site/route found) and why each pick won

| # | candidate | kind | picked? | why / why not |
|---|-----------|------|---------|----------------|
| 1 | P-mode palette omission (`hashing.py` PIL branch) | real upstream (reported) | baseline (fixed by oracle, not a lever of its own) | the advisory itself |
| 2 | PA-mode palette omission | real upstream | **yes (L_pa)** | real uncovered route; exact-mode checks miss it |
| 3 | palette dropped by the fixed-seed numpy sample for large images | real upstream | **yes (L_large)** | real uncovered route after the published fix; documented-tradeoff dismissal |
| 4 | PIL plugin classes (`Image.open` → `PngImageFile`, ...) bypass the exact FQN branch and are unhashable | real upstream | yes, but only as the shape behind the injected arm | on its own it raises `UnhashableTypeError`, not a collision; the injection makes it a route |
| 5 | `P`-mode `info["transparency"]` omitted | real upstream | no | real rendered difference and still open after the fix, but an obscure metadata shape; requiring it reads beyond the advisory's palette protection and a blind fix could not find it fairly |
| 6 | numpy arrays used as images differ outside the fixed sample | real upstream | no | same sampling concept as 3; adding it would be a second route of one concept |
| 7 | pandas/polars large-frame sampling | real upstream | no | not an image route; separately documented tradeoff, outside this property |
| 8 | arguments named with a leading `_` are not hashed | real upstream | no | documented opt-out; requiring it would contradict product documentation |
| 9 | a second hasher arm for PIL plugin classes hashing `tobytes()` | injected | **yes (L_opened)** | matches O8b #1; plausible compatibility addition; different class from the reported one |
| 10 | another sampling scheme for large values (stride) | injected | no | same concept as 3 |
| 11 | a per-call-site image fast path in the key builder (`cache_utils.py`) | injected | no | it would shadow the reported branch for every top-level image, so the published site would never be exercised and the task would stop being anchored to the advisory |
| 12 | media-file fingerprint in `memory_media_file_storage._calculate_file_id` | real upstream | no | a different sink (media file IDs, not cached-function keys); the screener also marks it out of scope |
| 13 | element-id hashing in `elements/lib/utils._compute_element_id` | real upstream | no | widget/element IDs, a different sink |
| 14 | image bytes handling in `elements/lib/image_utils.py` / `element/image.py` | real upstream | no | media-manager path, not cache keys |
| 15 | dataclass / Enum / module / class name-only hashing | real upstream | no | not image content; would broaden the property past the advisory and collide with deliberate design |

Picked: 2, 3, 9 (+ 4 as the shape of 9), with 1 as the reported baseline. The two real
how-type routes (2, 3) are in the same module but are genuinely open after the published
fix; the injected arm (9) is the far-in-message shape a maintainer would add.

## Test plan

Security (one test per route/shape, all through `@st.cache_data`/`@st.cache_resource`
decorated calls with a mock script-run context and memory storage):
- S1 reported P-mode palette collision, small images.
- S2 PA-mode palette collision.
- S3 large P-mode image, palette difference in bytes the fixed sample does not select.
- S4 `Image.open` PNG (P mode) with two palettes (hits the injected arm).
- S5 P-mode image nested inside a list/dict argument (the recursive form).
- S6 `@st.cache_resource` form of the reported shape (second public decorator).
Each asserts the second call returns the second image's rendered marker and the body ran
again; no exact status is asserted.

Functional (coupled behaviour; all must pass on the vulnerable+injected tree):
- identical images (separate objects) share one entry and one body run;
- legitimate large identical images share one entry;
- RGB images: same image shares, different image does not (existing behaviour);
- non-image values (int/str/numpy/pandas) keep their hit/miss behaviour;
- cache identity is stable across two processes with `persist="disk"` (L_stability);
- `@st.cache_resource` works with images;
- the project's own `hashing_test.py` (pristine copy).

## Wrong-fix patches

- `sf-no-pa.patch` — oracle with the check reduced to the reported mode only (misses L_pa).
- `sf-large-sample.patch` — oracle with the palette folded into the sampled array (misses L_large).
- `sf-no-opened.patch` — oracle without the injected arm's palette handling (misses L_opened).
- `ff-overbroad.patch` — image key additionally includes object identity (breaks identical sharing).
- `pass-hardening.patch` — oracle plus defensive hardening (transparency, exception-safe palette, type guard).
- `pass-alt.patch` — second valid design: hash the rendered RGBA of palette-carrying images.
- `blind-fix.patch` — declared, written downstream.

## What I could not verify

- Model trial outcomes (not run by the builder; gate only).
- Whether a blind fix would naturally hash the palette outside the sample; the route is open
  in latest upstream and the code makes it reachable.
- The exact current-upstream release number for `present_in_latest`; checked `develop` only.

## Gate log (2026-10-30)

- static: PASS.
- nop: PASS — 6/6 security tests fail on the pinned+injected tree, 87/87 functional pass
  (9 hidden functional + 78 project hashing tests).
- oracle: PASS — 3/3 identical trials, reward 1.0, 93/93 each.
- patches: PASS — sf-no-pa 0.8333, sf-large-sample 0.8333, sf-no-opened 0.8333 (each only its
  lever's security test failing, functional green); ff-overbroad 0.0 and ff-random-seed 0.0
  functional_fail; pass-hardening 1.0 and pass-alt 1.0. blind-fix.patch is declared and left
  for the downstream blind-fix step.
