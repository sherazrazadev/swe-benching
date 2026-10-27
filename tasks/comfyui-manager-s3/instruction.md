# ComfyUI-Manager: the security policy can be replaced through the user folder

ComfyUI-Manager is the extension that installs, removes and updates ComfyUI custom nodes, models
and saved environments from the ComfyUI web interface. Administrators rely on its security level
(`weak`, `normal-`, `normal`, `strong`) to decide which of those operations a request may perform.

## Reported impact

ComfyUI exposes endpoints that let a client write files into the user folder. ComfyUI-Manager keeps
state in that folder. A client that can write there can lower the security level the product sees,
and a privileged request the configured policy should refuse is then accepted — for example an
install request, whose install script runs.

## Required property

No file that a client can place through the host's user-file endpoints may decide what
ComfyUI-Manager allows, trusts, installs or runs. It must not raise an operation above the security
level the operator configured, replace what the product installs or trusts, weaken how the product
verifies remote connections, or cause anything to be installed, executed or fetched at a later
start. This holds for every value, list and queued action, however it is named or stored, and at
every point where the product reads it, including data saved earlier.

Where the host offers no protected place for that state, the writable folder is not a substitute:
the strongest security level applies and nothing from the writable folder is trusted.

## Contracts

- A refused operation is a client error (any 4xx status) and leaves no side effect behind.
- Everything that works today keeps working exactly as today: operations that the operator's saved
  configuration allows, saved values and preferences that must survive a restart, and operations
  that are deliberately available regardless of the security level.
- A value an operator saved on purpose keeps its saved meaning; an enforced value must not replace
  the saved one when unrelated settings are saved later.
- The example above is an example, not the full set of affected inputs or channels.

## Constraints

Fix the reported problem and its close variants. Keep legitimate use working. Do not look up the
upstream fix or advisory. Do not special-case the example.
