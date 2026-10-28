# Winter CMS: editing a template must not let it change the site

Winter CMS is a self-hosted content management system. Editors work in a back office and author
site content as templates — pages, layouts and partials — that mix HTML with an expression
language. An installation that does not fully trust everyone who edits templates can enable safe
mode: the editor refuses to save a PHP code section in a template, while HTML and expressions stay
editable.

## What we saw

With safe mode enabled, an account that may only edit pages stored this page body:

    {% set _ = this.theme.writeConfig({ name: "compromised" }) %}

The next render wrote the new name into the theme's configuration file. The account cannot change
that file through the back office, and cannot save a code section, so template content is reaching
further than the account is allowed to.

## What must be true

Template content is untrusted input. Rendering it must never execute arbitrary PHP, expose files or
host values that the template was not given, create, modify or delete stored files, or change
stored records. A render that would do any of these is refused with an error and leaves no such
effect, whichever template is rendered and whatever values the application passes in or the
template carries along.

## Contracts

- A refused render is a plain client error: an error page, or an error raised while the template is
  processed. It must leave no side effect — nothing executed, written, created, removed or changed.
- Everything that works today keeps working exactly as today: settings and stored values still bind,
  loops, conditions, partials and the built-in filters still render, lists and paged results
  supplied by the application still display, iterate and count, and callbacks written in the
  template still work on the values the application supplies.
- The example above is an example, not the full set of ways this can happen.

## Ground rules

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream fix
or the advisory. Do not special-case the example.
