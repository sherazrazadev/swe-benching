export interface TestResult {
  name: string;
  ok: boolean;
  error?: string;
}

type TestFn = () => void | Promise<void>;
const tests: {name: string; fn: TestFn}[] = [];

export function test(name: string, fn: TestFn): void {
  tests.push({name, fn});
}

export async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const t of tests) {
    try {
      await t.fn();
      results.push({name: t.name, ok: true});
    } catch (e) {
      results.push({name: t.name, ok: false, error: (e as Error)?.stack || String(e)});
    }
  }
  return results;
}

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual: unknown, expected: unknown, what: string): void {
  assert(
    actual === expected,
    `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

export function assertNotEqual(actual: unknown, unexpected: unknown, what: string): void {
  assert(
    actual !== unexpected,
    `${what}: value must not be ${JSON.stringify(unexpected)}`,
  );
}

export function assertNullish(value: unknown, what: string): void {
  assert(value === null || value === undefined, `${what}: expected no value, got ${JSON.stringify(value)}`);
}
