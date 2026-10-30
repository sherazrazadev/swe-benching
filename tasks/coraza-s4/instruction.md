# Keep every name of an uploaded part visible to rules

## The system

This project is a web application firewall library. An application places the
engine in front of its HTTP handlers and feeds every request through it. The
engine parses the request body, builds rule variables from what it finds, and
evaluates the deployment's rules; the application acts on the engine's answer.
For a `multipart/form-data` upload, rules see the uploaded files, their sizes
and names, the submitted form fields, and the names under which each part is
submitted. Deployments write rules such as "refuse an upload whose name ends in
`.php`". The variables involved are `FILES`, `FILES_SIZES`, `FILES_NAMES`,
`FILES_COMBINED_SIZE`, `MULTIPART_FILENAME`, `ARGS_POST` and
`MULTIPART_STRICT_ERROR`; the requirement below applies to each of them.

## Observed problem

A client uploads one part whose `Content-Disposition` header gives the same
upload two different names: an ordinary plain name and a second name carrying a
character-set tag, whose declared set is not UTF-8. The engine reports only the
plain name to the rules, while the application that receives the request
resolves the tagged name. A rule that refuses uploads named `shell.php`
therefore does not fire, and the application stores the file under the name the
rule was meant to catch.

## Security property (invariant)

For every part of an uploaded request body, every name by which a receiving
application can identify that part must be visible to the rule engine. Those
names are the name of the uploaded file and the name of the form field the part
is submitted under. This holds whichever syntax a part's headers use to express
a name: if a part declares more than one plausible reading of a name, every
reading must be visible to rules; if a part's headers cannot be interpreted
consistently, the request must be reported as malformed through the engine's
multipart strict-error signal so that the deployment's strict-validation rule
refuses it.

No uploaded part may be shown to rules under a name a receiving application
would not use, and no name a receiving application would use may be hidden from
rules.

## Keep working

Everything that works today keeps working exactly as today. In particular:

- an upload with a single unambiguous name exposes exactly one reading, and its
  size is accounted once;
- a part that states the same name in two equivalent forms still exposes one
  reading;
- a plain name stays visible when a differently spelled second name accompanies
  it;
- an ordinary form field remains a form field, and an ordinary file upload
  remains a file upload with its content type intact;
- a multi-file input whose parts share one form name keeps every file and every
  name.

For example, an upload of `report.pdf` that declares one name is ordinary and
must keep working; an upload that declares `shell.php` under one name and a
different second name for the same part is the case that must be caught. These
are examples, not the full set of inputs.

## Constraints

- Fix the underlying problem and its close variants, not just the example.
- Keep every legitimate use working.
- Do not special-case the example inputs.
- Do not consult any upstream fix, advisory, or changelog for this project.
- There is no network access.
