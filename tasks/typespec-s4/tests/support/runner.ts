/**
 * A tiny test runner for the hidden suites.
 *
 * The suites run under plain Node, not vitest, because the TypeSpec compiler loads
 * emitter packages with a dynamic import and vitest's transform cannot handle the
 * Alloy JSX runtime those packages pull in. Plain Node is also exactly how the
 * product runs, so the security property is exercised through the real runtime.
 *
 * Register tests with `describe`/`it`; the entry script imports every suite and
 * calls `runAll`, which writes a JUnit XML file for the grader.
 */
export interface RegisteredTest {
  suite: string;
  name: string;
  fn: () => unknown | Promise<unknown>;
}

const registry: RegisteredTest[] = [];
const suiteStack: string[] = [];

export function describe(name: string, fn: () => void): void {
  suiteStack.push(name);
  try {
    fn();
  } finally {
    suiteStack.pop();
  }
}

export function it(name: string, fn: () => unknown | Promise<unknown>): void {
  registry.push({ suite: suiteStack.join(" > "), name, fn });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export interface RunResult {
  total: number;
  failed: number;
  xml: string;
}

export async function runAll(): Promise<RunResult> {
  const groups = new Map<string, { name: string; error?: string }[]>();
  let failed = 0;

  for (const test of registry) {
    const started = Date.now();
    let error: string | undefined;
    try {
      await test.fn();
    } catch (e) {
      failed += 1;
      error = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
    }
    const elapsed = ((Date.now() - started) / 1000).toFixed(3);
    const group = groups.get(test.suite) ?? [];
    group.push({ name: test.name, error });
    groups.set(test.suite, group);
    void elapsed;
  }

  const suites: string[] = [];
  for (const [suite, cases] of groups) {
    const failures = cases.filter((c) => c.error !== undefined).length;
    const casesXml = cases
      .map((c) => {
        const attrs = `classname="${escapeXml(suite)}" name="${escapeXml(c.name)}"`;
        if (c.error === undefined) return `<testcase ${attrs}/>`;
        return `<testcase ${attrs}><failure message="${escapeXml(c.error.split("\n")[0])}">${escapeXml(c.error)}</failure></testcase>`;
      })
      .join("\n");
    suites.push(
      `<testsuite name="${escapeXml(suite)}" tests="${cases.length}" failures="${failures}">\n${casesXml}\n</testsuite>`,
    );
  }

  return {
    total: registry.length,
    failed,
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="hidden" tests="${registry.length}" failures="${failed}">\n${suites.join("\n")}\n</testsuites>\n`,
  };
}
