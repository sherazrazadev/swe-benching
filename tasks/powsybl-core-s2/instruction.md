# Local command execution

powsybl-core runs some of its analyses — for example the action simulator and the security
analysis commands of the itools command line — by launching an external program on the local
machine. A caller gives the local execution layer three things: the program to run, the arguments
for that program, and a map of environment entries for the child process. The layer passes them
through the operating system's shell.

## Observed impact

A user starts an action simulation with a contingency or DSL option whose value contains shell
syntax. The analysis starts, but the shell also runs the extra command written in that value.
Files outside the analysis working directory are created under the account running the analysis.

## What must hold

No program name, argument or environment entry supplied to the local execution layer may be
interpreted by the shell as anything other than literal data. It must not change the structure of
the command, start or end another command, or be expanded. This holds for every way a command can
be executed through the layer and for every value, however it is written.

If the layer cannot pass a value safely it may refuse the execution, and that refusal may surface
as an exception. Either way, nothing outside the execution working directory may be created,
changed or removed.

Everything that works today keeps working. A legitimate value keeps arriving at the child process
unchanged, including values with spaces, quotes, apostrophes, punctuation, percent signs,
exclamation marks, backslashes, empty text and non-ASCII characters. A setting that tells the
child where to look for programs keeps extending the current setting rather than replacing it.

The values in this report are examples, not the full set.

## Constraints

Fix the problem and its close variants. Keep legitimate use working exactly as it does today. Do
not look up the upstream fix for this report, and do not special-case the example values.
