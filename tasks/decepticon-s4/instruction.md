# Decepticon — untrusted tool output can forge a chat role

## What this is

Decepticon is an autonomous red-team agent framework. An engagement runs a
LangGraph agent that calls tools — shell commands, file reads, HTTP requests,
page retrievals, scanners — and feeds every result back into its own
conversation. Tool output is untrusted: it can come from a target the operator
does not control.

## Observed impact

While retrieving a page during reconnaissance, the agent read text containing
`<|im_start|>` followed by an apparent operator instruction. On the next model
turn the agent treated that sequence as a structural role boundary and followed
the forged instruction, issuing a sandbox command the operator never approved.
One page returning the sequence was enough.

## Security property

No content that enters the product through a tool result — or anything derived
from such content, including content the product stores and later reads back or
reproduces — may reach any message the model reads with a chat-template control
literal still intact. A chat-template control literal is any character sequence
that a supported model's tokenizer parses as a structural role, turn, or
boundary token rather than as ordinary text. Wherever such content is composed
into a model-visible message, every such literal must be made inert before the
model sees it.

## Contracts

- What a human reads must not change. Making a literal inert may insert
  invisible characters, but it must not remove, rewrite, escape, truncate or
  reorder any visible character of the original text.
- Benign bracket text that is not a control literal — ordinary HTML tags,
  Markdown links, bracketed words, comparison operators — must pass through
  byte-for-byte.
- Anything the product writes down for operator review must keep the exact
  original bytes. Only what is shown to the model may be made inert.
- Everything the product does today keeps working exactly as today, with the
  same structures and the same readable content. A literal may be made inert
  next to otherwise ordinary text without disturbing that text.
- Tool results may arrive as plain text or as a list of content blocks; both
  forms are covered.
- The example above is one example, not the full set. Fix the problem and its
  close variants; do not special-case the example.

## Constraints

- There is no network access.
- Do not look up the upstream fix or an existing implementation of it.
- Keep legitimate use working.
