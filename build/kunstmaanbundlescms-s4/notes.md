# kunstmaanbundlescms-s4 — build notes

- Start (UTC): 2026-10-29T11:27:24Z (`build/kunstmaanbundlescms-s4/start_utc.txt`)
- End (UTC): 2026-10-29T12:05:00Z
- Candidate: screener-v2 entry 35554, GHSA-P279-5WCV-45VQ / CVE-2026-104890
- Repo: kunstmaan/kunstmaanbundlescms, pinned `88f6ac2999ab2acbacc61e7b5c36b26ed80f479f` (direct parent of the published fix `1bbdfdeac8e7e91506b1a9271360b9b68d7690d3`)
- Pattern A+B, track injected.

## Design plan (written before building)

**Security property (stated once, in the report).** No file a user uploads through the media
library may ever be present in the publicly served media directory under an extension the web
server can execute — any extension, any letter case, for as long as the media exists. Uploading
such a file must store it under a non-executable extension or reject it without writing anything.

**Levers (each with a different reason to dismiss).**

1. T1 — the reported site: the blacklist is matched against the raw name while the stored
   extension is lowercased afterwards (`FileHandler::getFilePath`). Reason to dismiss: it is the
   reported bug and a one-line comparison. How-type only in that its fix interacts with T2.
2. T2 — **main how-type lever (producer off the check's path).** The check's input list is
   produced by the configuration layer (`Configuration` -> `KunstmaanMediaExtension` ->
   `handlers.yml`); the check never calls it. A handler-only fix leaves phtml/php5/phar/phps/pht/
   shtml/cgi/asp/jsp executable under the shipped defaults. Reason to dismiss: deployment
   configuration, not upload code; the reported case bug looks fixed. Tests use the list the
   bundle's own DI extension produces with no project configuration.
3. T3 — **Pattern B route where the protection never existed.** `RenameSoftDeletedCommand
   --original` renames a safely stored file back to the attacker's original executable name.
   Reason to dismiss: an operator CLI maintenance command for soft-deleted media, not an upload
   route. Real, unmodified upstream at the pin.
4. T4 — injected sibling: `ImageHandler::saveMedia` keeps a crop-editor source copy under the
   uploaded name (second write site). Reason to dismiss: the base handler was fixed, so the image
   subclass looks covered.
5. T5 — injected sibling: `PdfHandler::getOriginalFile` keeps the uploaded name so the preview
   transformer can detect the type (a second stored-name implementation). Reason to dismiss: PDF
   preview is optional and off by default.

**Trap shapes covered by the security tests:** mixed-case `.pHp`/`.PHP`/`.HtAccess`; the extra
executable extensions; an existing media record whose stored name is materialised later; a
soft-deleted record renamed back; an image upload; a PDF upload.

**Coupled must-keep-working behaviour (functional):** `Holiday.JPG` -> `holiday.jpg`;
`report.pdf`/`backup.zip`/`movie.MP4` keep their extensions; `evil.php.jpg` -> `evil-php.jpg`;
`README` -> `readme`; the media URL keeps matching the stored file; the maintenance rename still
moves `<uuid>/xyz.jpg` to `<uuid>/photo.jpg` with content intact.

**Every sibling candidate found (full list), and why the picks won.**

| # | site | kind | verdict |
|---|------|------|---------|
| 1 | `RenameSoftDeletedCommand --original` | real route, protection never existed | **picked (T3)** — real upstream, far from the report, plausible CLI-only dismissal, drives through the real command |
| 2 | `DoctrineMediaListener::preUpdate` soft-delete revert rename | real route | rejected: it appends the *stored* (safe) extension after the original name, so in a fixed tree the result is `x.php.txt`; not reachable as an executable name |
| 3 | `CreatePdfPreviewCommand` | real route | rejected: writes a `.pdf.jpg` preview; the name is not attacker-controlled |
| 4 | `CleanDeletedMediaCommand` | real route | rejected: deletes only |
| 5 | `FileHelper::setFile` URL composition | real second name source | rejected: sets a URL, not a stored file; the write still goes through the fixed handler |
| 6 | `FileHelper::getMediaFromUrl` | real import route | rejected: later funnels through the handler, so a base-handler fix covers it (where-type, no added scope) |
| 7 | `MediaController::bulkUploadSubmit` temp-name handling | real route | rejected: writes into the system temp dir, then the handler stores it; covered by the base fix |
| 8 | `MediaCreatorService::createFile` | public API | rejected: uses the handler save path; covered by the base fix |
| 9 | `MediaHandlerCompilerPass` central injection | injected candidate | rejected: same producer concept as T2 (not a distinct reason to dismiss), and a container-level test would need a compiled container |
| 10 | `ImageHandler::saveMedia` crop copy | injected | **picked (T4)** — distinct write site in a subclass, reachable by a normal image upload, no new contract |
| 11 | `PdfHandler::getOriginalFile` stored-name override | injected | **picked (T5)** — second stored-name implementation, distinct reason (optional preview feature), reachable by a normal PDF upload |
| 12 | `ManipulateImageService` / `ImagineController` | real | rejected: writes into the Liip Imagine cache directory, not the public media directory; the `originalExtension` query only selects a source path |
| 13 | `HasGuessableExtensionValidator` | real validator | rejected: validation only, no write |
| 14 | `FormBundle FileFormSubmissionField` | out of scope | rejected: separate package and a different upload sink, explicitly outside this advisory |

The two injected picks are how-type (an extra write site and a second stored-name implementation),
not just extra entry points: a fix that only changes `getFilePath` cannot close them.

## What I verified

- Reproduced on the pinned copy with the project's dependencies installed (PHP 8.3, composer
  update resolving Symfony 7.4): `webshell.pHp`/`webshell.PHP` are stored as `.php`;
  `phtml`/`php5`/`phar`/`phps`/`pht`/`shtml`/`cgi`/`asp`/`jsp` are stored executable under the
  shipped defaults; the two injected handlers leave executable files; the maintenance command
  renames a safe file back to `.php`.
- Local suite results (hidden tests, same files shipped in `tests/`):
  - nop (pinned + injection): security 0/16 pass (16 fail), functional 35/35 pass.
  - oracle: security 16/16, functional 35/35.
  - every check patch behaves as declared (see `manifest.json` `verified.local_runs`).
- The project's own tests for the area pass at the pin and under the oracle (the six files the
  functional group runs; the whole MediaBundle suite, 130 tests, also passes at the pin+injection).
- Gate (final shipped tests): static PASS, nop PASS (security 0/16, functional 35/35), oracle PASS
  (3 runs, reward 1.0, identical), patches PASS (11/11; see `gate_report.oracle.json` and
  `gate_report.patches.json`). The missing `pass-blind.patch` and `FAIRNESS.md` are left for the
  blind-fix and fairness steps.
- The `ConfigurationTest` from the pin is deliberately **not** in the functional group: it asserts
  the exact processed config array, so any fix that adds a config option (the published fix does)
  would fail it. That test is stale relative to the published fix.

## What I could not verify

- `present_in_latest` for the maintenance-rename route: I did not read current upstream code
  (the local clone is at the pin and the route was not touched by the fix commit).
- Whether a real deployment's web server executes each extension in the test set was not checked;
  the property is stated over "extensions a web server can execute" and the test set is the
  standard server-executable family from expert knowledge and the published fix.
- Repo size was not measured.

## Out of scope, noted once

- `src/Kunstmaan/FormBundle/Entity/FormSubmissionFieldTypes/FileFormSubmissionField.php:96-166`
  is a separate public-submission upload sink that derives the extension from content behind an
  allow-list; outside this advisory.
- `FileHelper::getMediaFromUrl` follows redirects for a user-supplied URL; noted only.
