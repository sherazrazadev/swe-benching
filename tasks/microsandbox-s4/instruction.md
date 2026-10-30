# Sandbox secrets are visible in the host process list

microsandbox runs workloads inside lightweight sandboxes (microVMs). To run a sandbox, the library starts a helper process on the host that boots and manages the sandbox for as long as it lives.

## What is wrong

A secret configured for a sandbox is readable from the command line of that helper process. On Linux a process's command line is world-readable: the process list (`ps`) and the process's command-line entry under `/proc` show it to every local user for as long as the sandbox runs.

For example, this sandbox publishes its API token to every user on the host:

```rust
let sandbox = SandboxBuilder::new("web")
    .image("alpine")
    .env("API_TOKEN", "live-token-value")
    .create()
    .await?;
```

## The property we need

No secret value supplied through a sandbox's configuration may ever be readable from the command line of any host process the library launches to run that sandbox. This holds in whatever form the value arrives — plain, structured, or encoded — and regardless of which part of the configuration carries it. The example above is one example, not the full set: fix the problem and its close variants, not just that value.

## What must keep working

Everything that works today keeps working exactly as it does today.

- Starting a sandbox still succeeds, and the process that runs it still receives the sandbox's complete configuration: every value supplied through the configuration — environment entries, secrets, paths, users and resource limits — still takes effect in the sandbox exactly as it does today.
- A sandbox stays identifiable in the host process list. Its name, its numeric id, its CPU count, its memory size and its log verbosity remain visible in the command line of the process that runs it, as they are today.
- A value that is not secret does not have to move off the command line, and hiding a secret must not change how any other value is interpreted.

## Constraints

- Fix the underlying problem and its close variants; do not special-case the example or filter one particular value.
- Keep the change inside this project. No new services, network access or dependencies are needed.
- Do not look up the upstream fix, the advisory, or any patch for this issue.
