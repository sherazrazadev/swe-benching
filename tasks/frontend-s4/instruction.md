# Entity-supplied labels are rendered as markup in chart tooltips

Home Assistant is a home-automation platform. Its web frontend shows dashboards and dialogs that
contain charts, and those charts use rich HTML tooltips so labels can be bold, multi-line and
colour-coded.

Names do not come from the chart: an entity's friendly name, a statistic's label, and the names
recorded for devices and areas all live in the entity and device registries.

## Observed impact

When a recorded name contains HTML, the Statistics graph tooltip renders it as markup. An entity
whose friendly name is `<img src=x onerror=...>` produces an image element inside the tooltip
instead of showing the literal name. Anyone who can set such a name — a user, an integration, or a
device that reports it — can put active markup in front of another user who opens the chart.

## What must never happen

A chart tooltip must display every value that Home Assistant holds for an entity, statistic,
device, area or other registered object as text. No such value may be parsed as markup, create
elements, or run — whichever chart displays it, whichever object it describes, and however the
chart's tooltip content is configured or supplied. A value that contains markup must appear
literally, or with the markup removed; it must never become part of the tooltip's structure.

The example above is an example, not the complete set.

## What must keep working

- Ordinary names, including names with punctuation and non-Latin characters, still appear in the
  tooltip as text.
- Tooltips keep the formatting users see today: bold labels, headings, line breaks, value layout
  and colour indicators.
- Charts still show their data, and every chart keeps working with the way it is configured today.
- Every other legitimate behaviour stays exactly as it is today.

## Constraints

Fix the problem and its close variants. Do not special-case the example. Keep legitimate use
working. Do not look up the upstream advisory or its fix.
