# Restrict the guest agent's control endpoint to the instance's main user

## The system

This project is a virtual-machine manager. Each instance runs a Linux guest with
a main user -- the account the instance is created for -- and other local
accounts may be added later. Inside the guest a small agent runs with the
highest privileges and gives the host the instance's control channel: the host
reaches it through a forwarded local endpoint and uses it for port forwarding
and other privileged operations. The agent is installed and started
automatically when the instance starts.

## Observed problem

An account in the guest that is not the instance's main user can use the agent.
It reaches the agent's control endpoint the same way the host does, the agent
accepts it, and that account obtains the agent's privileged capabilities.

## Security property (invariant)

The agent's control endpoint must be usable only by the instance's main user: no
other local account may reach or drive it, and the instance's main user must
keep being able to reach it. This must hold whatever starts the agent and
whatever privileges the agent runs with. A local account that is not the main
user must not be served, and nothing that account asks for may have any effect.

## Contracts

- An unauthorised local account's attempt fails; the agent does not serve it and
  the attempt has no side effect.
- The instance's main user is served normally.
- An agent started with no main user (that is, as root) is legitimate: it keeps
  serving root and no other account.
- Everything that works today keeps working exactly as today. In particular the
  agent is still installed and started when the instance starts, repeating the
  installation is harmless, the configured runtime state directory is still
  honoured, and an agent configured for a non-UNIX transport such as vsock or
  virtio still receives that transport setting.

For example, a service account created for an unrelated package connecting to
the agent's endpoint is the case that must not be served, while the main user's
own connection must keep working; an instance whose main user is root is
ordinary. These are examples, not the full set of inputs.

## Constraints

- Fix the problem and its close variants wherever the agent's control endpoint is
  made reachable.
- Keep every legitimate use working.
- Do not look up the upstream fix or any advisory for this project.
- Do not special-case the example.
