# Winter CMS: editing a template must not let it change the site

Winter CMS is a self-hosted content management system. Editors work in a back office and author
site content as templates — pages, layouts and partials — that mix HTML with an expression
language. An installation that does not fully trust everyone who edits templates can enable safe
mode, which is meant to keep template content within the template language.

## What we saw

With safe mode enabled, an attacker-chosen value appeared in the theme's configuration file after
template content was stored and rendered. The account that stored it cannot change that file
through the back office, so template content is reaching further than the account is allowed to.

## What must be true

Template content is untrusted input. Rendering it must never execute arbitrary PHP, expose files or
host values that the template was not given, create, modify or delete stored files, or change
stored records. A render that would do any of these is refused with an error and leaves no such
effect, whichever template is rendered and whatever values the application passes in or the
template carries along.

## Contracts

- A refused render is a plain client error: an error page, or an error raised while the template is
  processed. It must leave no side effect — nothing executed, written, created, removed or changed.
- Everything that works today keeps working exactly as today, for every value the application
  supplies to a template — including reading and counting stored records through that value.

## Ground rules

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream fix
or the advisory. Do not special-case the reported behaviour.
