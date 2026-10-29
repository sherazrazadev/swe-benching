# tract-s5 — build notes

- **Started (UTC):** 2026-10-28T23:50Z (build-run start)
- **Ended (UTC):** 2026-10-29T00:33Z (all four gate stages complete)

## Main lever and the others (different reasons to dismiss)

- **Main lever (how-type): T5** — a route where the protection never existed: the block-quantized
  graph branch replaces the stored shape with the graph-declared one. Reason to dismiss: the graph
  shape is deliberately authoritative there because the file stores a flattened matrix, so the
  hole reads as intended reshaping, and the plain branch's equality check looks like the whole
  policy.
- **Second (how-type): T7** — a shape trap in the injected bundle container: the reader validates
  the declared element count against the shape product (looks like the shape is checked) but
  computes the byte length with plain arithmetic. Reason to dismiss: the element-count check makes
  the shape look already validated, and the container is auxiliary.
- **Third (how-type): T8** — a legacy path: the injected pre-1.0 container has its own header whose
  fields have different units. Reason to dismiss: it is a deprecated format the current writer never
  produces.
- **Where-type extras:** T4 (same file, independent block formula) and T6 (another package's tensor
  deserializer) only cost a search; they are kept for coverage, not as the main difficulty.
- **Coupled must-keep (T2):** over-broad equality breaks the writer's own block-quantized payloads
  and packed one-bit booleans; MiMo-style over-hardening fails the functional suite.

## Levers (one line each)

- **T1 (reported route, `both`)** — the NNEF tensor-file reader multiplies model-declared dimensions
  with unchecked `usize` arithmetic (`nnef/src/tensors.rs:61-84`); the element count and the byte
  count wrap, leaving a tensor far larger than its storage. No reason to dismiss: this is the
  advisory's own site.
- **T2 (coupled must-keep, `mimo`)** — the obvious hardening (require `len * bytes_per_item ==
  data_size` for every weight file, dropping the sentinel-bits skip) rejects the library's own
  block-quantized payloads (18/36 bytes per 32 values) and packed one-bit booleans with a trailing
  partial byte (`nnef/src/tensors.rs:66-84`, `:286-295`). Tested functionally only.
- **T4 (uncovered upstream, `deepseek`)** — `read_block_quant_value` computes the payload size with
  its own unchecked `(q_m*q_k)/block_len*block_bytes` (`nnef/src/tensors.rs:274-295`). Dimensions
  whose element count fits a `usize` but whose Q8_1 byte count overflows slip past a fix at the
  plain reader. Reason to dismiss: an internal GGML-style extension with its own formula and a
  reader/writer item-type mismatch; the published fix never touches it.
- **T5 (uncovered upstream, `mimo`)** — for a block-quantized constant the graph-declared shape
  silently replaces the shape stored in the tensor file, with no payload check
  (`nnef/src/ops/nnef/deser.rs:105-122`), while the plain branch checks shape equality. Reason to
  dismiss: the graph shape is authoritative on purpose because the file stores the flattened
  matrix, so it reads as intended reshaping.
- **T6 (uncovered upstream, `deepseek`)** — the ONNX tensor deserializer builds a tensor from
  model-declared initializer dims and the raw payload through the same unchecked shared allocator
  (`onnx/src/tensor.rs:113-134` → `data/src/tensor.rs:282`). Reason to dismiss: another format
  crate and a shared core layer; the report never points there.
- **T7 (injected sibling, `deepseek`)** — a `TBND` weight bundle loader registered beside the
  existing loaders (`nnef/src/bundle.rs:45-80`, wired at `nnef/src/framework.rs:40`). It validates
  the declared element count against the shape product and then computes the byte length with
  plain arithmetic, so a shape whose byte product wraps yields a short payload for a huge shape.
  Reason to dismiss: the container declares its own element count and the reader checks it against
  the shape, so the shape looks already validated (element check vs byte check), and it is an
  auxiliary container, not the reported tensor file.
- **T8 (injected sibling, `mimo`)** — a legacy `TRT0` single-tensor reader
  (`nnef/src/legacy.rs:33-70`, wired at `nnef/src/framework.rs:35`). Same shape/element-count
  validation, then an unchecked `elem_count * elem_size` in a header whose fields have different
  units from the current format. Reason to dismiss: a deprecated container the current writer never
  produces, so a solver can argue the current reader is the whole scope.

All real routes are unmodified upstream code at the pinned commit. T7 and T8 are injected by
`environment/injection.patch` and are ordinary-looking maintainer code.

## Candidate list (every sibling site / route found) and why each pick won

1. `nnef/src/tensors.rs` plain reader — **picked (T1)**: the reported site.
2. `nnef/src/tensors.rs` `read_block_quant_value` — **picked (T4)**: a second, independent
   arithmetic in the same file; real; distinct dismissal (internal extension).
3. `nnef/src/ops/nnef/deser.rs` block-quantized graph shape — **picked (T5)**: real; the protection
   never existed on that branch; distinct dismissal (deliberate unflattening).
4. `onnx/src/tensor.rs` `create_tensor` — **picked (T6)**: a second implementation in another
   package; real; distinct dismissal (shared allocator / different crate).
5. `data/src/tensor.rs:282` `uninitialized_aligned_dt` — the shared sink behind T1/T6/T7/T8; not a
   site of its own (one checked product here closes T1/T6/T7/T8, which is why T1+T6+T7+T8 count as
   one *concept* in the fix design, but they remain separate routes and separate tests).
6. `linalg/src/frame/block_quant/storage.rs:20` `expected_bytes` — mirror of T4; covered by the T4
   fix and by the alternative design.
7. `data/src/tensor.rs:201` `from_storage` (unchecked `len`) — reached by T5's graph shape; no
   separate route.
8. `nnef/src/resource.rs` `SafeTensorsLoader` (`from_raw_dt(...).unwrap()`) — rejected: the
   safetensors crate validates the data slice against the shape, and the `.unwrap()` only turns a
   failure into a panic, which is not the silent short-allocation this property is about; no
   fixture constructs a passing header with a wrapped product.
9. `tflite/src/tensors.rs` `create_tensor` — real and unchecked, but the harness would need a
   FlatBuffers fixture writer and the whole tflite crate; rejected on build weight, not on merit.
10. `tensorflow/src/tensor.rs` `TryFrom<&TensorProto>` (`from_raw` with model dims) — same
    consideration; rejected on fixture weight.
11. `nnef/src/ops/nnef/deser.rs` other const paths — safe (the plain branch checks shape equality).
12. **Screener O8b `String` route — rejected after a behavioural check**: at the pinned commit the
    reader reaches `Tensor::zero_dt`, which returns `String doesn't implement num_traits::Zero`, so
    no tensor is allocated and no unchecked multiply is reached. Legitimate String tensors cannot be
    read back at this commit either, so it is neither an exploit nor a functional behaviour to
    preserve.
13. Block-quant writer/reader item-type mismatch (`0x3081` written, not accepted) — real, but the
    same sink as T4; adding it would be a second route of one concept (excluded by the design rules).
14. `write_tensor` u32 truncation — out of scope (save/reload corruption, not an out-of-bounds
    read); noted, not built.
15. Injected candidate: compressed/RLE `.dat` loader — rejected: would invent a format or add a
    dependency, and the arithmetic would duplicate the bundle loader.
16. Injected candidate: ONNX sparse initializers — rejected: heavy proto work, same crate as T6, and
    the shape check would sit in the same file a solver already edits for T6.
17. Injected candidate: a CLI-level second reader — rejected: the CLI path funnels into
    `read_tensor`, so it is the same route as T1.

**Why the two injected picks beat the rest:** the bundle loader is the only candidate that is far
from the report, genuinely plausible as maintainer code, reachable through the real model entry
point, and carries a *how-type* shape trap (an element-count check that makes the shape look
validated while the byte multiply is still unchecked). The legacy reader adds a second, independent
header parser with different field units and a different reason to dismiss (deprecated/legacy), so a
fix that handles the bundle's `elem_count * elem_size` does not automatically cover it.

## What I verified

- Reproduced every security route on the pinned+injected tree: 9/9 security tests fail (0 pass),
  functional 11/11 pass.
- The reference fix: 9/9 security and 11/11 functional pass.
- The published fix alone (`checks/upstream_fix.patch`) closes the four plain-reader tests only and
  leaves five security tests failing — the recall check holds.
- Every `checks/*.patch` applied to a clean pinned+injected tree and run through both hidden
  suites: each `miss_*` fails exactly its own security test with functional green; `sf_crash` fails
  a security test by panicking; both over-broad fixes fail legitimate weight files; `pass_hardening`
  and `pass_alt` score 20/20.
- `cargo test -p tract-nnef -p tract-data -p tract-linalg` at the pinned+injected tree: 3036 tests
  passed, 0 failed.
- Static gate: PASSED.
- Screener O8b String route disproved behaviourally (see above).

## What I could not verify

- No target model was run (by instruction); the difficulty claim is the design, not a trial result.
- `present_in_latest` for the real routes was taken from the sibling task's read of upstream
  origin/main on 2026-10-26 (T4/T5/T6 still present); I did not re-fetch upstream today.
- The two injected containers are new code; they have no upstream `present_in_latest` value.
- Gate results are recorded in `build/tract-s5/gate_report.partial.*.json`.

## Gate results

- `--only static`: PASSED.
- `--only nop`: PASSED (security 9, functional 11; all security tests fail on the vulnerable tree).
- `--only oracle`: PASSED (3 trials, reward 1.0, identical).
- `--only patches`: PASSED (12/12 declared; blind.patch is written downstream).
- Upstream origin/main was checked today at 7e8be2f3: the plain reader is fixed there; the
  block-quant reader still multiplies block_bytes with plain arithmetic after a checked product,
  and both the block-quantized graph branch and the ONNX deserializer are unchanged.
