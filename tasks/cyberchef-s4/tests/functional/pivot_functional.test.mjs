import test from "node:test";
import assert from "node:assert";

import PivotTable from "../../src/core/operations/PivotTable.mjs";

const PIVOT_ARGS = ["Line feed", "Comma"];

test("[functional/pivot] ordinary grouped data is still shown as a table", () => {
    const pivot = new PivotTable();
    const data = pivot.run("r1,c1,10\nr1,c2,20\nr2,c1,30", PIVOT_ARGS);
    const html = pivot.present(data);

    assert.strictEqual(typeof html, "string");
    for (const text of ["r1", "r2", "c1", "c2", "10", "20", "30"]) {
        assert.ok(html.includes(text), `the legitimate value ${text} was not displayed`);
    }
});

test("[functional/pivot] a value is placed in the right row and column", () => {
    const pivot = new PivotTable();
    const data = pivot.run("r1,c1,10\nr1,c2,20\nr2,c1,30", PIVOT_ARGS);

    assert.strictEqual(data.r1.c1, "10");
    assert.strictEqual(data.r1.c2, "20");
    assert.strictEqual(data.r2.c1, "30");
    assert.strictEqual(data.r2.c2, undefined);
});
