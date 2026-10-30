# Security report: a checkpoint's configuration can run code when a model is set up

## What the product is
This is a Python library for loading pretrained machine-learning models from checkpoint
directories. A checkpoint is a folder of JSON configuration data plus model weights. A caller can
obtain just a checkpoint's configuration, or build the model, through the library's public
auto-classes or by constructing the configuration and model classes directly. Some models are
composite: one model's configuration embeds another component's configuration as a nested value
(for example, a keypoint-matching model embeds the configuration of its keypoint detector).

## Observed impact
A user obtains a keypoint-matching checkpoint from a third party and asks the library to set it up
(for example, `AutoConfig.from_pretrained(checkpoint_dir)`, then building the model from that
configuration). The checkpoint's `config.json` contains a nested detector component and a boolean
value that asks for custom code. While the configuration is being set up, the library fetches and
runs a Python module from a location named inside the checkpoint. The module is not part of the
library and the user never reviewed it. A checkpoint the user expected to treat only as data
therefore gets code execution on the user's machine.

## Required invariant
No value carried by a checkpoint — including any nested or referenced configuration, and any value
that asks for custom code — may cause code to be fetched or executed from a location that the
checkpoint names. Custom code may be used only when the person performing the operation explicitly
asks for it for that checkpoint; the checkpoint's contents must never supply that permission.

The invariant applies however a configuration or model is obtained from a checkpoint.

## Contracts
- A checkpoint that cannot be honoured safely must be refused with a clear error instead of running
  the code. If setup can continue using the library's built-in components only, it may continue,
  but no code named by the checkpoint may run.
- Everything that works today keeps working. A nested detector configuration that uses only
  built-in components must keep loading, and its supplied values (layer sizes, thresholds,
  dimensions and other ordinary settings) must bind exactly as before, including when the nested
  configuration also carries harmless metadata such as where that component came from. A model
  built from such a configuration must keep building and running.
- A checkpoint that uses only built-in components must remain usable even when it also carries a
  value that asks for custom code: that value is data, not permission, and must not by itself make
  an otherwise ordinary checkpoint unusable.
- The examples above are examples, not the full set.

## Constraints
- Fix the problem and its close variants.
- Keep legitimate use working exactly as today.
- Do not look up the upstream fix.
- Do not special-case the example.
