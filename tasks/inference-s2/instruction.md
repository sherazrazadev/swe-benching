# A model's reply can run as code on the serving host

## System

Xorbits Inference is a self-hosted platform for serving models behind OpenAI-compatible HTTP
routes. A chat request may declare tools (`tools` in the request body). The model then answers
with a tool call, and the platform turns that reply into the `tool_calls` field of the chat
response; a reply that is not a tool call comes back as the assistant's `content`.

## Observed impact

A reply that is written as a Python object is executed on the server instead of being read as
data. With a chat request that declares tools, a model reply containing a Python expression runs
that expression inside the serving process: a crafted reply can create files or start commands.
The caller does not send code — the model's own completion text is the payload.

```
POST /v1/chat/completions
Content-Type: application/json

{"model": "<a model that answers with Python-style tool calls>",
 "messages": [{"role": "user", "content": "..."}],
 "tools": [{"type": "function", "function": {"name": "get_weather", "parameters": {}}}]}
```

This is one example, not the full set of features or reply forms that reach the same behaviour.

## Security property that must hold

No text a model produces may ever be executed as program code by the product, whichever feature
receives it and whatever form the model chose for its output. Model output is data. When output
cannot be read as a well-formed tool call, it comes back to the caller as ordinary assistant
content; it is never run and never becomes a tool call.

## Contracts the fix must honor

- **Unreadable output is content.** Text that is not a well-formed tool-call object is returned
  unchanged as the assistant message, with no tool call and no error.
- **Today's working calls keep working.** A tool call written as an ordinary JSON object still
  binds, including parameters that are numbers, strings, lists, or nested objects. A tool call
  written as a Python literal — single-quoted strings, and the words `True`, `False` and `None` —
  still binds exactly as it does today.
- **An empty reply is content.**
- **Everything else that works today keeps working exactly as today.**

## Constraints

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix. Do not special-case the example.
