import fs from "node:fs";
import path from "node:path";
import { compile, NodeHost, type Program } from "@typespec/compiler";
import { createAssetEmitter, TypeEmitter } from "@typespec/asset-emitter";

// The hidden suites are copied into packages/openapi3/test-hidden at grading time, so
// `import.meta.dirname` is .../packages/openapi3/test-hidden/support. Specs are compiled
// from a scratch directory under the openapi3 package so the workspace libraries resolve.
const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..", "..");
const TEMP_ROOT = path.join(PACKAGE_ROOT, "temp");

export interface Project {
  /** Scratch directory handed to the emitter as the caller-chosen output root. */
  base: string;
  /** The caller-chosen output directory. */
  out: string;
  /** The directory the emitter writes to (inside `out`). */
  emitterDir: string;
  /** The spec file. */
  main: string;
}

export function makeProject(emitter: string): Project {
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  const base = fs.mkdtempSync(path.join(TEMP_ROOT, "hidden-"));
  const out = path.join(base, "out");
  const main = path.join(base, "main.tsp");
  const emitterDir = path.join(out, "@typespec", emitter.replace("@typespec/", ""));
  return { base, out, emitterDir, main };
}

export async function runEmitter(
  project: Project,
  emitter: string,
  spec: string,
  options: Record<string, unknown> = {},
): Promise<Program> {
  fs.writeFileSync(project.main, spec);
  return compile(NodeHost, project.main, {
    outputDir: project.out,
    emit: [emitter],
    options: { [emitter]: options },
  });
}

export function cleanup(project: { base: string }): void {
  fs.rmSync(project.base, { recursive: true, force: true });
}

/** Every entry below `root`, including directories, sorted. Missing roots yield []. */
export function walk(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    out.push(full);
    if (entry.isDirectory()) out.push(...walk(full));
  }
  return out;
}

/**
 * Assert that nothing was created outside the emitter's output directory.
 *
 * Allowed: the input spec, the caller-chosen output directory and the directories on the
 * way to the emitter output directory (the compiler creates them), and anything inside the
 * emitter output directory. Everything else under the scratch root is a violation.
 */
export function expectContained(project: Project): void {
  const allowed = new Set<string>();
  let cursor = project.out;
  allowed.add(cursor);
  for (const part of path.relative(project.out, project.emitterDir).split(path.sep)) {
    cursor = path.join(cursor, part);
    allowed.add(cursor);
  }

  const offenders = walk(project.base).filter((entry) => {
    if (entry === project.main) return false;
    if (allowed.has(entry)) return false;
    return entry !== project.emitterDir && !entry.startsWith(project.emitterDir + path.sep);
  });

  if (offenders.length > 0) {
    const shown = offenders.map((p) => path.relative(project.base, p)).join(", ");
    throw new Error(`output was written outside the emitter output directory: ${shown}`);
  }
}

/**
 * Run an emitter through the compiler and assert that every file it creates stays inside
 * the emitter output directory. The scratch directory is always removed.
 */
export async function expectEmitterContained(
  emitter: string,
  spec: string,
  options: Record<string, unknown> = {},
): Promise<void> {
  const project = makeProject(emitter);
  try {
    await runEmitter(project, emitter, spec, options);
    expectContained(project);
  } finally {
    cleanup(project);
  }
}

export interface AssetProject {
  base: string;
  out: string;
  main: string;
  emit: (name: string, content?: string) => Promise<string>;
}

/** A real compiler program plus the public asset-emitter factory writing to `out`. */
export async function makeAssetProject(): Promise<AssetProject> {
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  const base = fs.mkdtempSync(path.join(TEMP_ROOT, "hidden-asset-"));
  const out = path.join(base, "out");
  const main = path.join(base, "main.tsp");
  fs.writeFileSync(main, "model A {}");
  const program = await compile(NodeHost, main, { noEmit: true });

  class ScratchEmitter extends TypeEmitter {}

  const emitter = createAssetEmitter(program, ScratchEmitter, {
    emitterOutputDir: out,
    options: {},
  } as any);

  return {
    base,
    out,
    main,
    async emit(name, content = "marker") {
      const sourceFile = emitter.createSourceFile(name);
      sourceFile.globalScope.declarations.push({
        name: "marker",
        value: content,
        scope: sourceFile.globalScope,
      } as any);
      await emitter.writeOutput();
      return sourceFile.path;
    },
  };
}

/** Assert every entry under the asset project's scratch root is the spec or inside `out`. */
export function expectAssetContained(project: AssetProject): void {
  const offenders = walk(project.base).filter(
    (entry) =>
      entry !== project.main && entry !== project.out && !entry.startsWith(project.out + path.sep),
  );
  if (offenders.length > 0) {
    const shown = offenders.map((p) => path.relative(project.base, p)).join(", ");
    throw new Error(`output was written outside the emitter output directory: ${shown}`);
  }
}
