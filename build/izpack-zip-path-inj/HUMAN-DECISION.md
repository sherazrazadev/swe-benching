DECISION: KEEP
DATE: 2026-10-30

Delegated owner decision on the review's three questions:
(i) Yes. The stated rule covers the location "ultimately used", and values from installer variables never pass the metadata loader, so a use-site check is required; a loader-only guard is incomplete, not an alternative.
(ii) Yes. The instruction says a refused location is surfaced as an installation failure; the unpacker result is that surface.
(iii) Acceptable. The writer's existing boolean/catch path is the product's refusal form; no trial errored on this (all writer-test failures were files escaping, not exceptions).
