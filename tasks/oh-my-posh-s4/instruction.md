# A directory name on the prompt can run a program

oh-my-posh draws the shell prompt from a theme. A theme is written in template
syntax: expressions in double braces call helper functions, and some of those
helpers run a program, read a file, or read and expand a variable. Theme
authors rely on that.

Not all of the text a prompt shows is written in the theme. Some of it is data
the product obtained elsewhere and then displays; some is theme text that has
been combined with such data. That text is data. It must be displayed, never
interpreted.

## Observed impact

A user changes into a directory whose name is `{{ cmd "touch" "PWNED" }}` and
receives a prompt. The displayed path is interpreted as template text, so the
directory name runs: a file named `PWNED` appears in the current directory.
Whoever can name a directory the prompt will show can run programs with the
user's privileges. The theme itself is ordinary and no option is needed.

## The property that must hold

Text that the product did not take verbatim from the user's theme must never be
able to run a program, read a file, or otherwise reach the host through the
template helpers — no matter where that text came from, how it was supplied, or
what unrelated theme text it happens to match. Only expressions the theme
author wrote may use those helpers.

## Refusal form

A refused value must not abort the prompt. The prompt still renders, showing
that value as it appeared or leaving it out, and no program runs and no file is
read on its behalf.

## What must keep working

- Expressions written in the theme keep working exactly as today, including
  ones that run a program, read a file, or read and expand a variable.
- The path segment's own theme options keep being interpreted as the theme
  author's template text.
- Every other legitimate behaviour stays exactly as it is today.

The directory name and command above are examples, not a complete list.

## Constraints

- Fix the reported problem and its close variants.
- Keep legitimate use working.
- Do not special-case the example.
- Do not look up the upstream advisory or its fix.
