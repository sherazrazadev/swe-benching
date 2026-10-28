# A supplied value can add configuration to the log collector

## System

This project is the Kubernetes operator that turns logging configuration objects into the
configuration of the fluentd log collector it runs. A cluster-wide logging resource describes the
collector itself; namespaced flow and output resources describe how records are matched, filtered
and delivered. On every reconcile the operator assembles that configuration as text and hands it
to fluentd, which reads it line by line: a line either opens or closes a directive, assigns a
parameter, or does nothing.

## Observed impact

A user who may create flow and output resources in their own namespace supplies an ordinary
single-value setting whose text contains a line break. The operator copies the value into the
generated fluentd configuration unchanged, so the value ends its line and the rest of the text is
parsed as configuration of its own — for example a new section that selects another plugin. The
operator reports success and writes the resulting configuration. The user gains no additional
Kubernetes permission; the extra configuration runs inside the collector.

## The security property

A string supplied for a single fluentd configuration setting must never end the configuration line
it is written on, open or close a directive, or otherwise add, remove or re-target configuration:
it stays exactly one value of that setting. This holds for every setting the operator writes into
the fluentd configuration it generates, whatever object supplies the value and however that value
reaches the generator. Where a supplied value cannot be represented as one value of its setting,
the operator must fail the operation with an error and produce no configuration.

## Contracts the fix must honor

- **Refusal form.** Where a supplied value cannot be represented as one value of its setting, the
  generation must return an error and leave no configuration behind. Any error is acceptable; no
  particular message or status is required.
- **Placement.** The protection belongs to the code that produces the configuration, so that it
  holds for every path that produces it — not only for one caller of that code.
- **Magnitudes.** Legitimate values are ordinary single-line settings; the attack value is one that
  contains a line terminator.

## What must keep working

Everything that works today keeps working exactly as today. In particular, every value that
contains no line break must keep producing exactly the configuration it produces today, including
values that contain quotes, backslashes, `#`, commas, colons or braces, values that are structured
data or that the operator assembles from several pieces before writing them, and values that reach
a setting indirectly rather than as a literal string on the object. None of these may start being
quoted or escaped.

The example above is an example, not the full set of cases.

## Constraints

- Fix the problem and its close variants; do not special-case the example.
- Keep legitimate use working exactly as it does today.
- Do not look up the upstream fix or advisory.
