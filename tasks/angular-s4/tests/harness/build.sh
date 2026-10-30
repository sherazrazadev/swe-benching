#!/usr/bin/env bash
# Compiles the hidden test bundles (tsc with Angular's decorator metadata, then esbuild).
# usage: build.sh <workspace> <tests-dir> <out-dir>
set -eu
WS="$1"; TESTS="$2"; OUT="$3"
NODE_MODULES="${CWE_NODE_MODULES:-/opt/node_modules}"
TOOLS="${CWE_TOOLS:-/opt/harness/node_modules}"
export NODE_PATH="$NODE_MODULES"
REL_TESTS=$(python3 -c 'import os,sys;print(os.path.relpath(sys.argv[1],sys.argv[2]))' "$TESTS" "$WS")
rm -rf "$OUT" && mkdir -p "$OUT/js"
cat > "$OUT/tsconfig.json" <<JSON
{
  "extends": "$WS/packages/tsconfig.json",
  "compilerOptions": {
    "rootDir": "$WS",
    "outDir": "$OUT/js",
    "types": [],
    "emitDecoratorMetadata": true,
    "declaration": false,
    "inlineSourceMap": false,
    "sourceMap": false,
    "noEmitOnError": false,
    "skipLibCheck": true,
    "ignoreDeprecations": "6.0"
  },
  "include": [
    "$TESTS/security/entry.ts",
    "$TESTS/functional/entry.ts",
    "$TESTS/security/host_bindings.ts",
    "$TESTS/functional/host_bindings.ts",
    "$TESTS/support/framework.ts",
    "$TESTS/support/helpers.ts",
    "$TESTS/support/angular_setup.ts"
  ]
}
JSON
"$NODE_MODULES/.bin/tsc" -p "$OUT/tsconfig.json" > "$OUT/tsc.log" 2>&1 || true
grep -q "error TS" "$OUT/tsc.log" && grep "error TS" "$OUT/tsc.log" | grep -v "TS5101\|TS5107" | head -20 || true
cat > "$OUT/bundle-tsconfig.json" <<JSON
{"compilerOptions": {"baseUrl": "$OUT/js", "paths": {"@angular/*": ["packages/*"]}, "resolveJsonModule": true}}
JSON
for g in security functional; do
  "$TOOLS/.bin/esbuild" "$OUT/js/$REL_TESTS/$g/entry.js" \
    --bundle --platform=node --format=esm --target=node22 \
    --outfile="$OUT/$g.mjs" --tsconfig="$OUT/bundle-tsconfig.json" \
    --resolve-extensions=.js,.mjs --ignore-annotations --log-level=error
done
echo "build ok"
