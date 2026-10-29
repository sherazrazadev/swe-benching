# Kestra UI: authored Markdown can turn text into active markup

Kestra is a workflow orchestration product. Its browser UI renders Markdown that users
write in many places: flow and task descriptions, dashboard Markdown panels, plugin
documentation, execution logs and error messages. On top of standard Markdown, Kestra's
rendering layer supports its own extensions.

## Observed impact

A user who can save Markdown somewhere another user will view can make script run in the
viewer's browser. Saving a flow whose description is

    [[link x="y" onmouseover="alert(document.domain)"]]

and opening that description from the Flows list ran the handler for the viewer. That
text is not HTML: Kestra's own rendering turned it into a live attribute.

## What must be true

Markdown written by a user must only ever produce the formatted document content the
product intends. No value the author writes may become active markup: no event handler,
script, stylesheet, embedded object or script-bearing URL may reach the rendered page
because of author-supplied text, whichever part of the rendering flow places that text.

Markup that an author writes directly as HTML inside documentation Markdown is a
supported feature and must keep working; this requirement is about text that Kestra's
own rendering turns into markup.

## What must keep working

Everything that renders today must render exactly as it does today. In particular, every
value the product already reads from authored text and uses — to build a link
destination, to show a link's visible text, or to name a rendered block — must keep
being used exactly as it is now.

Author-supplied text is content. Wherever the product shows it as text today it must
still be shown as text; wherever the product builds a link from it, the link must still
point at the same destination.

The snippet above is one example, not the complete set. Fix the problem and its close
variants, keep legitimate use working, do not look up an upstream fix, and do not
special-case the example.
