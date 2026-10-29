# A weight file whose declared dimensions overflow is accepted

Tract is a self-contained inference toolkit: it reads neural-network models together with the
weight files they carry, builds an inference plan and runs it. Models and weight files are
untrusted input — they arrive from model zoos, download caches and third parties.

**Observed impact.** A weight file whose header declares dimensions that overflow the arithmetic
used to size its tensor is read without error. In one reproduction, pointing the library at a model
directory holding `graph.nnef` and a weight file whose header declared two dimensions of 2147483648
yielded a tensor claiming 4611686018427387904 elements while its payload held none, and consuming
that tensor reads past the end of its storage.

**The property.** No tensor that a model or weight file declares may have a shape whose element
count, or whose byte size, overflows the arithmetic used to size it; and no tensor may be created
from a shape that does not match the data the model carries for it. Anything for which those numbers
do not fit, or do not match, is refused with an error before any tensor is created.

**Contracts.**
- A refusal is an ordinary error returned to the caller: no panic, no abort, and no partly built
  model.
- Everything that works today keeps working exactly as today, including weight files whose stored
  payload is not exactly the element count times the element size, empty and scalar tensors, and
  tensors of several gigabytes with a matching payload.
- Large tensors are legitimate: no fixed cap on dimensions, element counts or byte sizes is
  acceptable.
- The reproduction above is an example, not the full set.

Fix the problem and its close variants. Keep legitimate use working. Do not look up the upstream
fix. Do not special-case the example above.
