# Control-panel support widget displays received text as markup

## System

This project is a content management system. Administrators work in a control
panel, and its dashboard offers a **Craft Support** widget: an administrator
can search public sources for material that already covers a problem, read the
matching entries as a list, and contact the vendor's support desk. The widget is
a browser component: it receives search results as JSON and builds the result
list from them.

## Observed impact

An administrator searches the issue tracker from the widget. A result whose
title contains markup is displayed as markup instead of as text: an entry title
that contains an element carrying an event handler runs script in the
administrator's authenticated control-panel session. Supplying such a title
through the public issue tracker is enough to trigger it the next time anyone
searches from the widget.

## Security property

No value that the widget receives may be interpreted as markup or script
anywhere the widget displays it. Every such value must appear as literal
characters. Every value the widget shows today keeps appearing in the same
place, in full and with the same visible characters, and the widget's own
presentation keeps working: a search result stays an ordinary link to its
destination and keeps its status indicator.

## Contracts

- Every legitimate use keeps working and no legitimate value disappears.
  Ordinary values next to a hostile one keep rendering exactly as they do
  today.
- Text keeps being shown in full, including characters such as `&`, `<`, `>`
  and quotation marks.
- The same rule applies to every value the widget displays, not only the value
  in the example above, and to the widget as it runs in the control panel, not
  only as it is written in the project.

The example is an illustration, not the full set of ways the property can be
violated.

## Constraints

- Fix the flaw and its close variants, not just the exact example shown.
- Keep every legitimate use working.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
