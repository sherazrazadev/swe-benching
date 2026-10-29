# aqua: a package's files can be written outside its install directory

aqua is a CLI version manager. A registry entry declares a tool and the release asset to
download. Installing a package downloads that asset and extracts it into the tool's own
package directory under the aqua root before the command is made available.

The release asset is attacker-controlled content. With a `.tar.gz` asset that contains an
entry named `../outside.txt`, installing the package (with `aqua install`, or when another
command installs the missing package first, such as `aqua exec`) writes `outside.txt` next to
the package directory instead of inside it, at a path the package never should have reached.

The property that must hold: extracting a downloaded package must never create, modify or
otherwise affect anything outside that package's own install directory. An asset that would
do so is refused with an error, and no such outside effect is left behind.

Everything that works today must keep working exactly as it does today.

The `../outside.txt` entry is one example, not the full set of ways an asset can reach outside
its directory. Fix the problem and its close variants rather than special-casing the example,
keep legitimate packages installing, and do not look up the upstream fix.
