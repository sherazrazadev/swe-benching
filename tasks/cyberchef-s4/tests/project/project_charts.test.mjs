// Runs the project's own chart operation tests (restored from pristine copies by test.sh) through
// the project's Chef-backed test register. The product source under test is the agent's.
import test from "node:test";
import assert from "node:assert";

const WORKSPACE = process.env.WORKSPACE_DIR || "/workspace";

test("[functional/project] the project's own chart operation tests pass", async () => {
    const {default: TestRegister} = await import(`${WORKSPACE}/tests/lib/TestRegister.mjs`);
    await import(`${WORKSPACE}/tests/operations/tests/Charts.mjs`);

    const results = await TestRegister.runTests();
    const failed = results
        .filter(result => result.status !== "passing")
        .map(result => `${result.test.name}: ${result.output || result.status}`);

    assert.ok(results.length > 0, "the project's chart tests did not run");
    assert.deepStrictEqual(failed, [], failed.join("\n"));
});
