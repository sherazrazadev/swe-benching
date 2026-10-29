# Code execution from data left in a project's build directory

kapt is the annotation-processing step of a Kotlin/JVM build. The Gradle plugin and the
command-line runner start it, and it keeps incremental state in the project's build directory so
later runs can skip work. That state is plain Java-serialized data.

## What happens

Start annotation processing for a project whose build directory already contains data from an
earlier build — for example a build directory restored from a shared or externally produced build
output — and kapt reconstructs the objects stored there. If those bytes name any class, the class
is loaded and its serialization callbacks run while the build starts, before any source is looked
at. A build directory that the project did not produce itself therefore becomes code execution
inside the build, with the build's privileges.

## What must hold

Data that a build left on disk is untrusted. Reading it back must never construct, resolve, load
or run any class other than the fixed set of value types kapt itself writes for that data. This
holds for every file kapt reads back from a project's build outputs, whatever its name, format or
size, and whatever the shape of the data inside it — a class reached directly, or reached through
a container or another object that is itself acceptable.

Data outside that set is rejected as a whole and discarded. Rejection is not a build failure: the
run continues without that data, exactly as if the file were absent. A class outside the set must
not be constructed at any point, not even while the data is being examined and rejected.

## What must keep working

Everything that works today keeps working exactly as today. Data written by one build is read
back by the next with the same meaning, incremental state stays incremental, and a build
directory holding any number of entries loads completely. The existing public entry points keep
their signatures and their current behaviour for legitimate data.

The files, formats and objects mentioned above are examples, not the full set.

## Constraints

Fix the problem and its close variants. Keep legitimate use working exactly as it does today. Do
not look up the upstream fix for this report, and do not special-case the example.

The repository is in `/workspace`. There is no network. `/opt/verify/compile-lib.sh` compiles the
affected library for a quick check.
