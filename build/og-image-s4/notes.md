# og-image-s4 build notes

Start UTC: 2026-10-30T00:04:14Z
End UTC: 2026-10-30T01:21:46Z

Candidate: nuxt-modules/og-image, advisory GHSA-Q8HW-4FVP-9RWV / CVE-2026-61793.
Pinned 5aa6dbf0b3848b578a87144032cfb6b734454b56; published fix 243cac2228671d3711c2bd65e300c278fcdf5a4e.
Pattern A, track injected.

## What the flaw is (one line)

A visitor-supplied `fonts` entry in the image URL becomes a font path that the platform font
handler fetches; an authority-bearing or externally-redirected path makes the server contact any
host, including loopback/internal services.

## Levers (one line each)

- T1 `same_origin_redirect_and_trusted_origin` (A, how-type, main): the same-origin font fetch
  follows a redirect from the site origin to another host; the fix must re-validate each hop while
  still trusting the origin's own (possibly loopback) host. Sites: node.ts:12-15,
  dev-prerender.ts:101-108, ssrf.ts:226-230/257-259. Security fail: sf_miss_redirect.patch.
- T2 `authority_form_canonicalisation` (A, how-type): network-path (`//host`), backslash-authority
  and control/space-prefixed forms resolve cross-origin through the WHATWG parser although a scheme
  check calls them relative. Classifier in the new external-url.ts, reached from every handler.
  Security fail: sf_naive_scheme.patch.
- T3 `second_platform_implementations` (A, where-type): the dev/preview, Cloudflare and two injected
  handlers each resolve fonts themselves; fixing only the reported node handler leaves them open.
  Security fail: sf_node_only.patch.
- T4 `serverless_handler_injected` (injected, where-type): a Vercel/Lambda-style handler copied from
  the node handler; no gate in it. Security fail: sf_miss_serverless.patch.
- T5 `netlify_handler_injected` (injected, where-type): a Netlify handler enabling the shared asset
  resolver's external fallback; no gate in it. Security fail: sf_miss_netlify.patch.
- Coupled functional (main over-broad trap): a relative same-origin font on a loopback origin and an
  inline `data:` font must both keep loading. ff_refuse_all.patch breaks them.

## Candidate sibling list (every site/route considered before picking)

Published/real handlers that resolve a font path: node.ts; dev-prerender.ts (including its
`/_fonts/` mapping fetches and its dev same-origin branch); cloudflare.ts (fetchLocalAsset);
the shared fetchLocalAsset external-fallback branch; fetchWithRedirectValidation (shared guard);
loadDefinedFonts (option boundary); decodeOgImageParams/context merge (producer). Existing
attacker-reachable non-font sinks considered and rejected as outside this advisory's property:
devtools.ts page fetch (`_path`), browser/screenshot.ts path, takumi renderer image `src` (dev
branch), imageSrc.ts (guarded image src), emojis/fetch.ts (hardcoded iconify). A path-traversal
route via font filenames in dev-prerender is a different protection and was not pursued.

Picks: T4 and T5, because they are the only independent ways to reach the font sink that a fix at
the published sites cannot cover, they are reachable through the real `/_og/d/` entry point of a
built platform output, and they carry different mechanisms (raw fetch vs shared-resolver external
fallback) and different reasons to skip. The dev and Cloudflare handlers (T3) are real upstream
code and remain the pattern-A far sites.

## Verified locally (no Docker)

- Injected-pinned tree: all 20 security tests fail (loopback canary contacted); all 277 functional
  tests pass (4 rendered-image files + project unit tests ssrf/fonts/urlEncoding/ipv6-font-fetch).
- Oracle (published fix + injected-handler gates): all 20 security and 277 functional pass.
- Full verifier flow exercised outside Harbor with the real verifier image on a /workspace restored
  from the agent image (node_modules/dist/.nuxt/.git excluded, exactly as the artifact excludes
  them): nop reward 0.0 (0/20 security, 277/277 functional); oracle reward 1.0 (20/20, 277/277).
- Platform harness: node-server and `nuxt dev` over real HTTP; Vercel Node function, Netlify v2
  function and a Cloudflare worker built with the renderer pinned to the node compatibility path,
  each run in a plain Node process behind a real HTTP server (no wrangler/workerd).
- The published fix's own test/unit/font-ssrf.test.ts is absent at the pin and is NOT used; the
  hidden tests import no new helper, so no guessed file/function name is required.
- Wrong-fix checks, each run against the injected tree (security pass count / functional pass count):
  sf_miss_redirect 18/20 sec, 277/277 fun; sf_naive_scheme 10/20, 277/277; sf_node_only 7/20,
  277/277; sf_miss_serverless 16/20, 277/277; sf_miss_netlify 18/20, 277/277; pass_hardening
  20/20, 277/277; pass_alt 20/20, 277/277. ff_refuse_all is the functional-fail check (it makes
  the coupled legitimate fonts unavailable).

## Gate results

- static: PASSED.
- nop: PASSED on the first Harbor run (20 security tests all fail on the injected tree; 277
  functional pass).
- oracle: PASSED (3 runs, reward 1.0 each, identical; 20/20 security, 277/277 functional).
- patches: PASSED (8/8 present checks behaved as declared): sf_miss_redirect reward 0.9,
  sf_naive_scheme 0.5, sf_node_only 0.35, sf_miss_serverless 0.8, sf_miss_netlify 0.9,
  ff_refuse_all 0.0 (6 functional failures), pass_hardening 1.0, pass_alt 1.0. The blind pass
  patch is produced downstream.

## Could not verify / unknowns

- Cloudflare.ts is exercised through a build whose renderer is pinned to the node compatibility
  path so the worker can run offline in Node; the Cloudflare *binding* selection is unchanged, but
  a real workerd run was not used (wrangler local needs a pinned compatibility date and was
  deliberately avoided for reliability). No functional test is possible there because the fixture
  has no Cloudflare ASSETS binding, so a blocked/legitimate font cannot be rendered; only the
  security side effect is asserted.
- The serverless handlers' legitimate same-origin load cannot be exercised offline: the built
  Vercel/Netlify function does not route the platform's static assets, so the only functional
  positive control is the inline `data:` font (which renders because it supplies the font itself).
- Vercel/Netlify bundles are Node-specific output; a different Nitro minor could change their
  export shape. The platform server handles the Vercel Node listener and the Netlify/Cloudflare
  fetch contracts; the pinned lockfile fixes the versions.

## Outside this advisory's scope (noted, not built)

- dev-prerender reads files from disk using the attacker-supplied font filename (a path-traversal
  property, different protection).
- The takumi renderer's image `src` dev branch fetches without a block check (an image-src sink,
  not the font-path property).
