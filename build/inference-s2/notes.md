# inference-s2 — build notes (build-v1, pattern A+B, injected)

Start UTC: 2026-10-28T03:49:32Z
End UTC: 2026-10-28T04:25:52Z

## Gate results (2026-10-28, final revision, one stage at a time)

Re-run end-to-end on the shipped files after the last robustness edits; every stage passed:
`static` 04:15:06, `nop` 04:16:18, `oracle` 04:18:42, `patches` 04:18:42-04:25:52.
The sections below record the same outcomes from the first full pass.


## Gate results (2026-10-28, one stage at a time)

- `static` PASSED (no warnings; the only pass patches are hardening/alternative here);
  the missing `blind` patch and `FAIRNESS.md` are left for downstream, as instructed.
- `nop` PASSED: 8/8 security tests fail on the pinned+injected tree, 44/44 functional pass
  (14 hidden + 30 pristine project tests).
- `oracle` PASSED: 3 runs, reward 1.0 each, identical per-test results.
- `patches` PASSED: all 11 declared checks behave as declared. `sf-llama3-only` leaves 5
  security tests failing; each `sf-no-*` leaves exactly its lever's security test(s) failing;
  all four functional-fail patches fail only functional tests (json-only 5, refuse-all 5,
  crash 7, adjacent 1 hidden + 3 project); `pass-hardening` and `pass-alt` score 1.0.
  The blind patch is declared but not built (produced downstream).


## Candidate and pinned state

- Advisory: GHSA-X2RJ-828P-HX9M / CVE-2026-61539 / PYSEC-2026-3946 (xorbitsai/inference, CWE-95).
- Vulnerable commit: `4cefcaa1e63d7e29d26bcd4be96cb267da113871` (parent of the published fix).
- Published fix: `1b3d220f342ce68d34cec4586d9409d457dadc42` (only tool parsers + the mixin copy).
- Screener record was treated as a lead. Re-verified at the pinned commit: the parser copies and the
  OCR route all execute a marker payload through the product's own code (see "Verified" below).

## The one security property (written before any route was chosen)

> No text a model produces may ever be executed as program code by the product, whichever
> feature receives it and whatever form the model chose for its output. Model output is data.
> When output cannot be read as a well-formed tool call, it comes back to the caller as
> ordinary assistant content; it is never run and never becomes a tool call.

Contracts stated once for the whole product: unreadable output is returned as assistant content
(no tool call, no error); a JSON tool call still binds, including boolean/null/number/list/nested
parameters; a Python-literal tool call (single-quoted strings, `True`/`False`/`None`) still binds
exactly as today; an empty reply is content; everything else keeps working as today.

Every route and sibling below is covered by that paragraph as written. The report names only the
chat-with-tools trigger; it never names or paraphrases a feature, file, format, or stage of any
other route.

## Levers (each with a different reason a solver would dismiss it)

1. **OCR visualisation route** — pattern B / route where the protection never existed; **how-type**.
   `xinference/model/image/ocr/deepseek_ocr.py:231` (`extract_coordinates_and_label`), reached from
   the public `DeepSeekOCRModel.ocr(..., save_results=True, save_dir=...)` route (the REST
   `/v1/images/ocr` handler calls `ocr`). The `<|det|>` coordinates are model output and are
   `eval`'d. *Reason to dismiss:* it is a different feature — bounding-box coordinates, a vision
   model, not chat tool calls — and the advisory title scopes the issue to tool parsers. Real,
   unmodified upstream code; the published fix never touched it.
2. **Legacy family-dispatch second implementation** — pattern A second implementation; where-type.
   `xinference/model/llm/utils.py:753` (`ChatModelMixin._eval_llama3_chat_arguments`, reached through
   `_eval_tool_arguments`). The published fix changed it as well. *Reason to dismiss:* it is legacy
   dead code at the pinned commit (no in-tree caller; every backend uses the registered parser), so
   it looks unreachable and safe to leave.
3. **Gemma argument fallback (injected)** — restricted-builtins `eval`; **how-type** (the "sandbox"
   is escapable). `xinference/model/llm/tool_parsers/gemma_tool_parser.py:61`
   (`_parse_arguments`). Reachable through the same completion post-processing route with the
   registered `gemma` parser. *Reason to dismiss:* it already removes `__builtins__`, so it looks
   like a safe literal evaluator.
4. **MiniMax parameter-value fallback (injected)** — `eval` on one leaf `<parameter>` value;
   shape trap / local-looking. `xinference/model/llm/tool_parsers/minimax_tool_parser.py:56`
   (`_parse_param_value`). Reachable through the same route with the registered `minimax` parser.
   *Reason to dismiss:* it parses only one scalar parameter value after `json.loads` already
   handled real input, so it looks harmless and local.

Coupled must-keep-working behaviour (functional tests, next to every lever): Python-literal tool
calls (single quotes, `True`/`False`/`None`) keep binding; ordinary JSON tool calls with
boolean/null/number/list/nested parameters keep binding; non-object/malformed/empty output comes
back as assistant content instead of raising; the legacy dispatch keeps parsing valid calls; the
gemma parser keeps parsing its unquoted-key/quoted-token form; the minimax parser keeps parsing
JSON scalar values; legitimate OCR coordinates still draw and save the annotated image.

## Every sibling site/route found, and why the picks won

| candidate | location | kind | usable? |
|---|---|---|---|
| OCR visualise coordinate eval | `deepseek_ocr.py:231` | real route, public `ocr()` | **picked (1)** — real, reachable, far, different feature |
| OCR text-block coordinate eval | `deepseek_ocr.py:399` | real code, `extract_text_blocks` has no in-tree caller | rejected — dead helper; cannot be driven through a real route |
| legacy llama3 mixin copy | `utils.py:753` | published-fix far site | **picked (2)** — the published fix protects it |
| gemma key-normaliser fallback | `gemma_tool_parser.py` | injected sibling | **picked (3)** — sandboxed-eval judgement trap |
| minimax per-parameter parser | `minimax_tool_parser.py` | injected sibling | **picked (4)** — leaf-value shape, local-looking |
| deepseek mixin `_eval_deepseek_chat_arguments` | `utils.py:759-824` | legacy dead duplicate | rejected — dead like the llama3 mixin copy, and its registered parser is the live one; no test can reach it without inventing a caller |
| registered deepseek-v3 parser fallback | `deepseek_v3_tool_parser.py` | injected sibling candidate | rejected — same concept as the gemma sibling (JSON fallback), no new dismissal reason |
| qwen parser fallback | `qwen_tool_parser.py` | injected sibling candidate | rejected — same concept as gemma; adds routes of one concept |
| glm4 dict-arguments parser | `glm4_tool_parser.py` | injected sibling candidate | rejected — same JSON-fallback concept |
| vllm backend self-parsing | `vllm/core.py:1744` | O8b lead | rejected — needs vLLM/GPU, not runnable offline |
| vendored DeepSeek-VL2 demo | `thirdparty/deepseek_vl2/.../utils.py:284` | O8 lead | rejected — vendored third-party Gradio app, not xinference's surface |
| megatts3 hparams config eval | `thirdparty/megatts3/.../hparams.py:62` | out-of-scope note | rejected — config loader, not model output; outside this advisory |
| streaming variants | gemma/minimax streaming | route variant | not added — same sink and same fix as the non-streaming sibling; "more routes of one concept" |

Pick rule: how-type over where-type, far from the reported parser, plausible dismissal, each with a
different dismissal reason. The two injected siblings are the most complex/hardest-to-judge
candidates (a sandbox escape in one, a local leaf-value eval in the other); the same-concept parser
injections were dropped to avoid padding.

## Input shapes the security tests cover

- a builtin call with no dunder and no `import` (`open(...).write(...)`) — defeats a blocklist fix;
- an object-traversal payload that works with `__builtins__` removed — defeats "sandboxed" eval;
- an expression nested inside a parameter value (the check never inspects inner expressions);
- the same payload through the reported parser, the legacy dispatch, both injected parsers, and the
  OCR coordinate route;
- the OCR route driven through the public `ocr()` method with a stubbed model returning the text.

## Verified before building

- llama3 parser, legacy dispatch: payload writes the marker through `ChatModelMixin._post_process_completion`
  / `ChatModelMixin._eval_tool_arguments` at the pinned commit; Python-literal JSON/call behaviour recorded.
- OCR: `DeepSeekOCRModel.ocr(..., save_results=True, save_dir=...)` with a stub `infer` writes the
  marker before any drawing; legitimate coordinates save `result_with_boxes.jpg`.
- Injected siblings: both write the marker through the same completion route and keep their normal
  calls parsing; the project's tool-parser tests (23) stay green after the injection.
- `eval(text, {}, {})` exposes builtins and `eval(x, {"__builtins__": {}}, {})` is escapable via
  `().__class__.__bases__[0].__subclasses__()`.

## Could not verify

- Whether both target models fail all three attempts (the bar); trials are run downstream, not here.
- Whether external callers use `ChatModelMixin._eval_tool_arguments` outside this repository.
- The static gate reports `warnings`, `types` and `PIL` as product imports in the security
  tests; those are stdlib/test or third-party imports, not product code (reported only, not judged).
