# answer-s2 build notes

- Start UTC: 2026-10-28T07:03:44Z (pipeline start)
- End UTC: 2026-10-28T07:38:06Z (patches stage finished)

## Advisory and scope
GHSA-6QWM-5FM9-CVJX / CVE-2026-34033 / GO-2026-6151, apache/answer, CWE-79/CWE-80 stored HTML
injection through server-rendered email templates. Pinned vulnerable commit
`11c80384f13a27e27c871c05bb353489d1363ee2` (parent of published fix
`d1a4092c61ccd41988d1033fce47eb513adb433e`). Pattern B, track INJECTED.

## Mechanism (one line)
The email service substitutes user- and settings-supplied values into fixed HTML bodies with Go
text-template interpolation, so a value containing markup becomes live HTML in the message.

## Levers (one line each)
- T1 (A, report): answer notification escapes nothing (display name, title, excerpt). Dismiss: none
  (reported); couples to the subject and link.
- T2 (A+B): comment notification, own body/method. Dismiss: report shows an answer notification.
- T3 (A+B): invite notification, own body/method. Dismiss: a different event.
- T4 (A+B): new-question fan-out, title plus the joined tag string. Dismiss: joined slice / fan-out.
- R1 (B, how-type: protection absent + stored-config route): registration, password-reset and
  address-change bodies substitute the stored site name; the settings reader entity-decodes it
  (`siteinfo_common/siteinfo_service.go:83`), so a name stored as `&lt;...&gt;` becomes live markup.
  Dismiss: admin-set and sanitiser-passed, so it reads as trusted; the published fix skipped these
  three bodies. Real, unmodified upstream; still unescaped on origin/main.
- S1 (injected, how-type: protection absent): accepted-answer email. Dismiss: a status action on
  existing content, not a posting.
- S2 (injected, how-type: protection absent): closed-question email. Dismiss: an administrator's
  moderation notice.
- C1 (how-type, coupled must-keep-working): the body is HTML while the same values feed a plain-text
  subject; escaping the finished body or the shared data destroys markup, links and subject.
- C2 (how-type, ordering): the link address is built from the raw title; escaping the value before
  the address is built changes the link.

Two levers are how-type in the strict sense (R1, C1/C2); S1/S2 are absent-protection routes with a
reason to dismiss. The report names none of R1/S1/S2/C1/C2.

## Sibling candidate list (screener O8/O8b plus own search) and why the picks won
Examined every place a supplied value reaches an HTML email body at the pinned commit:
1. Registration/activation body - stored site name. **Picked** (part of R1).
2. Password-reset body - stored site name. **Picked** (part of R1).
3. Address-change body - stored site name. **Picked** (part of R1).
4. Admin SMTP-test template - rejected: `email_tpl.test.body` does not contain the site name (only
   the subject does), so there is no body sink. The screener's O8 lead is wrong on this one.
5. Subject lines of the four content templates - rejected: the subject is not HTML; header/CRLF
   injection is a different weakness family, and escaping it breaks the plain-text display that
   the coupled functional tests protect.
6. "You were mentioned" email - rejected: the in-app mention exists, but the email would need the
   comment content, author and question across three services, and mentions are a parsed
   username identity (a different concept). Accepted-answer/closed-question reuse an existing
   in-app action with the data already in hand.
7. "Your post was edited" email - rejected: no in-app counterpart; more invention than 6/S1/S2.
8. Digest email building HTML inline in the notification package (second implementation) -
   rejected: no existing digest feature, and the notification service holds a concrete
   `*EmailService`, so a hidden test could not observe the body without a local SMTP sink. Too much
   invented infrastructure for a plausible-maintainer standard.
9. External notification plugins - rejected: out of this repository (plugin boundary), out of scope.
10. In-app notification title stored raw - rejected: different sink; the web client renders it as
    text, not the server-rendered email body.
11. Other site-settings getters - rejected: no email template consumes them.
12. Install-time site name - rejected: same stored value/sink as R1, no separate route.
Picks: R1 (three routes, one producer, one reason to dismiss), S1, S2. R1 is the strongest because it
is real upstream code the published fix missed and the producer entity-decodes the value; S1/S2 were
the most plausible injected siblings because the product already emits the corresponding in-app
notifications and the producers already hold the question and actor.

## Gate results (all four stages)
- static: PASS (no leaks; strict checks satisfied; only the downstream blind patch is absent, which static permits)
- nop: PASS - 17/17 security tests fail on the vulnerable injected tree, 10/10 functional tests pass
- oracle: PASS - 3/3 runs reward 1.0, identical results
- patches: PASS - all 12 check patches behave (7 security_fail, 3 functional_fail, 2 pass at 1.0)

## Verified
- Reproduction and oracle through the real rendering methods with the real translator (i18n bundle
  loaded from the repo) and a stand-in site-settings service that implements the product interface.
- Stored-site-name route driven through the real `siteinfo_common.GetSiteGeneral` over a stored JSON
  document (content `{"name":"&lt;img ...&gt;", ...}`): the reader returns live `<img ...>`.
- Behaviour of the product's sanitiser on entity-encoded names: `&lt;img src=x onerror=...&gt;`
  survives sanitisation as entities and is decoded on read, which is the R1 producer mechanism.
- On the injected tree: 17/17 security tests fail, 9/9 hidden functional tests pass, project tests
  pass. On the oracle tree: 17/17 security and 9/9 functional pass; project tests pass.
- All 12 check patches generated from the injected tree and locally confirmed: seven
  `security_fail`, three `functional_fail`, two `pass` (hardening and alternative). All apply
  `-p1` to a clean injected tree; `solution/fix.patch` applies to a clean injected tree.
- Injected tree builds (`go build ./internal/...`) at the injected commit; `CGO_ENABLED=0` builds
  the affected packages.
- The two injected notification methods are reachable: the external notification dispatcher routes
  their queue messages, and producers send them from `POST /answer/acceptance` and the admin
  question-status path.

## Could not verify
- `present_in_latest` for the three site-name routes: read from origin/main in the local clone; the
  three bodies still substitute the raw name there. (Checked by reading `origin/main`, not by
  running the current release.)
- Whether a non-administrator can ever set the site name: only the admin site-info route and the
  one-time install request were read. R1's dismissal reason relies on the value being
  administrator-set; the property still covers it because it is a value the product stores.
- The full HTTP routes were not executed (they need a database and a live server); the rendering
  entry point they call is exercised directly, with data within the request-limit constraints.
- Repository source size and queue-storage details from the screener record were not re-measured.

## Out of scope (one line)
- The same substituted values also reach the Subject header; header/CRLF injection is a different
  weakness family and was not pursued.
- External notification plugins build their own mail bodies outside this repository; not pursued.

## Could-not-fix / design notes
- `email_tpl.test.body` has no dynamic value, so the screener's "admin SMTP test" uncovered route is
  not a body sink; excluded.
- `blind.patch` and `FAIRNESS.md` are intentionally absent (written by the downstream step).
