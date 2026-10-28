# file-viewer-xss-inj — build notes

Start: 2026-10-28T07:02:54Z
End: 2026-10-28T07:27Z

## Advisory / pin
- GHSA-3753-M2X2-Q623 / CVE-2026-91127, flyfish-dev/file-viewer, XSS (CWE-79/CWE-83):
  unsafe URL schemes and attribute injection in the legacy DOC HTML renderer.
- Vulnerable commit 772ae40de07e48134de0449997cb4924b0cde3e4; published fix ef045680f8d9830a3eee9612f7df46a734361b07
  ("fix(security): harden legacy DOC rendering boundaries").

## Entry point and reproduction
The public entry points are the DOC renderer's library API (`renderMsDoc` on a caller-supplied AST,
`parseMsDocToHtml` on bytes), the DOM helpers (`mountMsDoc`, `createMsDocViewer`), the module worker's
`render` message, and the Word renderer package's `.doc` handler (`renderFileViewerWordDoc`) including
the export adapter it registers. Reproduction on the pinned+injected tree: a crafted legacy `.doc`
whose HYPERLINK field target is a `javascript:` URL renders an anchor with that destination through
`parseMsDocToHtml`/`renderMsDoc`; every DOM mount inserts it; the Word export adapter emits it too.
A caller-supplied AST reproduces the same sink for text runs, linked images, picture fallbacks,
inline attachments, the trailing attachments block, table-cell links, font-family values,
linked-picture targets and style names. The crafted `.doc` is derived at test time by rewriting the
two INCLUDEPICTURE field instructions in the project's `image-linked.doc` fixture into same-length
HYPERLINK fields (no parser offsets move).

## Levers (one line each)
- T1 (A, base): document hyperlink target becomes an anchor destination — `render/html.ts:245`; reason
  to dismiss: none, this is the reported site.
- T2 (A, far site): the Word renderer's print/export adapter builds a "Document links" appendix from
  the parsed AST instead of the mounted page — `wordDoc.ts:491-498`; reason to dismiss: the Word/DOCX
  package looks out of scope and export is a separate trusted adapter.
- T3 (B, injected sibling): a linked picture's recorded target is offered as an open link in the image
  fallback — `render/html.ts:249-257`; reason to dismiss: linked-picture metadata is internal bookkeeping,
  not a hyperlink.
- T4 (B, injected sibling): the document style name is written raw into a `data-style` attribute —
  `render/html.ts:348-350`; reason to dismiss: style names are internal theming identifiers, not content.

All three injected siblings are ordinary product-shaped code in the surrounding style, reachable through
the real public entry points, and are applied to our copy only through `environment/injection.patch`.

## What was verified
- Built and exercised locally at the pinned commit, on the pinned+injected tree, and on the reference fix.
- Pinned+injected: 0/17 security tests pass (all fail), 12/12 functional tests pass.
- Reference fix: 17/17 security and 12/12 functional pass, on a jsdom document (no browser binary).
- Project's own DOC checks run unchanged and pass on both trees: verify-github-171, verify-github-192,
  verify-github-34, verify-github-87, verify-table-spec (part of the functional group).
- Check patches (in `build/file-viewer-xss-inj/checks/`), each applied to the pinned+injected tree and
  re-built:
  - sf-miss-base: 12 pass / 5 security fail, functional 12/12 — security_fail
  - sf-miss-linked: 15 pass / 2 security fail, functional 12/12 — security_fail
  - sf-miss-styleattr: 16 pass / 1 security fail, functional 12/12 — security_fail
  - sf-miss-export: 16 pass / 1 security fail, functional 12/12 — security_fail
  - ff-overbroad: security 17/17, functional 4 pass / 8 fail — functional_fail
  - pass-hardening: 17/17 + 12/12 — pass
  - pass-alt (mount sanitiser without DOMPurify): 17/17 + 12/12 — pass
- The environment pre-installs a general-purpose HTML sanitiser so either design is possible offline.
- Gate stages (all clean):
  - static: PASSED.
  - nop: PASSED — security 0/17, functional 12/12, reward 0.
  - oracle: PASSED — 3 runs, reward 1.0 each, 29/29 identical.
  - patches: PASSED — 7/7 as declared (sf-miss-base 24/29, sf-miss-linked 27/29,
    sf-miss-styleattr 28/29, sf-miss-export 28/29, ff-overbroad 21/29 with 8 functional
    failures, pass-hardening 1.0, pass-alt 1.0).
  Per-stage reports: gate_report.{static,nop,oracle,patches}.json. The `blind` pass patch is
  produced downstream by the pipeline and was not written here.

## What could not be verified
- The screener's repository-size figure was not measured; the monorepo is large but only the three
  affected workspace projects are installed.
- Current upstream code after the fix commit was not inspected beyond the fix commit itself.
- Browser-engine URL normalisation is approximated by stripping control characters in the tests; the
  suites run on jsdom, which does not execute injected handlers, so the assertions are about markup
  (absence of active destinations and of event-handler attributes), not about executing a payload.
- No real covered-route (pattern B) gap was confirmed in unmodified upstream code; the screen found
  none, so all added gaps are injected siblings (registered in build/audit/uncovered-routes.tsv).

## Scope notes
- The DOCX renderer has its own externalLinkPolicy handling; not examined or built on.
- The fix commit also touches SECURITY.md, CHANGELOG and release metadata; those changes are not source
  and are not part of the reference patch.
