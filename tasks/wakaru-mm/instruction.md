# Unpacking can write outside the chosen output directory

Wakaru is a JavaScript decompiler and bundle splitter, used as a command-line tool and as a Rust
library. `wakaru <input> --unpack -o <dir>` splits a bundle into one file per module and writes the
files under `<dir>`; the library exposes the same unpacking through its public entry points.

We unpack bundles that come from places we do not control. A bundle whose module was named as a
crafted path was written outside the output directory: running
`wakaru crafted.js --unpack -o out` created or overwrote a file next to `out` instead of under it.

**Invariant.** Nothing taken from an input document may let a write leave the output directory that
the caller chose. In particular, every module name an unpacking entry point reports must be a safe
relative path built only from ordinary components — no `.` or `..` component and no root or drive
prefix — so that any caller writing that name below a directory stays inside it. The same must hold
for every file a command writes from its input, including when any existing part of the destination
path is a link to somewhere else. Extra dots inside a name are ordinary characters; they do not make
the name a traversal. The case above is one example, not the full set.

**Contracts.**

- Refusal is a client error with no side effect: a refused command writes nothing outside the output
  directory (and no part of the refused input), and a library entry point returns an error rather
  than module names. A caller must not have to re-check names it is handed.
- Ordinary use must keep working: bundles with nested module paths a few directories deep, names
  that contain extra dots as literal directory components, repeated names (which are disambiguated
  with a numeric suffix), and every bundle format and option the tool accepts today must keep
  producing the same modules for benign input.
- An output directory may already contain ordinary files and links; only a write that would leave
  it is refused.

Fix the problem and its close variants; keep legitimate use working; do not look up the upstream
fix; do not special-case the example.
