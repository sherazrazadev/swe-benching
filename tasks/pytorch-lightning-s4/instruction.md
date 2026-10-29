# A downloaded checkpoint must not be able to run code while a model is restored from it

## System

PyTorch Lightning trains PyTorch models. Training writes a checkpoint: a file holding the
model's weights plus the settings needed to rebuild the model. A load call rebuilds the object
from such a file. Checkpoints are commonly downloaded from model zoos or shared between users,
so their contents are not necessarily written by the person who loads them.

To make nested, typed constructor arguments restorable, the library records the class of the
object and the classes of some of its constructor arguments in the checkpoint, and resolves
those class references when it rebuilds the object. That is supported behaviour and must keep
working.

## Observed impact

A checkpoint downloaded from a public model zoo was loaded with

```python
MyModel.load_from_checkpoint("downloaded.ckpt")
```

The caller did not ask to run any code, and nothing about the call said it would. While
rebuilding the model, the library imported an unrelated Python module and called a function
named by the checkpoint's saved settings, before the caller ever received a model.

## Security property

A checkpoint may supply data for the library's own rebuilding logic to interpret; it may never
supply the logic itself. Other than the library's existing restoration of an object's own class
and the classes of its typed constructor arguments, no value in a checkpoint may cause the
library to import or call code that the checkpoint names. A checkpoint containing such a value
must be refused before anything it names is imported or called, however that value is placed in
the checkpoint and wherever the library rebuilds an object from a checkpoint.

## Contracts the fix must honor

- **Refusal.** A checkpoint that tries to name code to run is rejected: the load call raises an
  ordinary error and does not return an object rebuilt from that checkpoint. Nothing named by
  the checkpoint is imported or called first.
- **Preservation.** A checkpoint the library saved itself restores exactly as today: the same
  model or datamodule class, the same typed constructor arguments (including nested class
  references), and the same stored values.
- **Plain data stays data.** A stored value that merely looks like a dotted or module-like name
  is an ordinary value and is restored unchanged.
- **Legitimate sources.** Values the caller passes to the load call, and values read from a
  saved-settings file, keep overriding stored values as today.

The example above is one instance, not the full set of ways the property can be violated.

## Constraints

- Fix the flaw and its close variants, not just the example shown.
- Keep every legitimate use working; do not remove a feature to avoid the problem.
- Do not special-case the example input.
- Do not consult any upstream advisory or fix for this issue.
- There is no network access.
