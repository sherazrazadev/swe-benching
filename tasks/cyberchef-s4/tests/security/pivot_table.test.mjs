import test from "node:test";
import assert from "node:assert";

import PivotTable from "../../src/core/operations/PivotTable.mjs";
import {uniqueToken, payloadFor, ESCAPED_PREFIX, lookupOwn, deleteSharedProperty} from "../helpers.mjs";

const PIVOT_ARGS = ["Line feed", "Comma"];

test("[security/pivot] a row label spelled like an internal slot does not modify shared objects", () => {
    const token = uniqueToken("pivotrow");
    const marker = payloadFor(token);

    try {
        const pivot = new PivotTable();
        const table = pivot.run(`__proto__,${marker},1`, PIVOT_ARGS);
        const html = pivot.present(table);

        assert.strictEqual(typeof html, "string", "the table view did not return output");
        assert.strictEqual(Object.prototype[marker], undefined,
            "processing the data changed an object shared by every operation");
        assert.ok(!html.includes(marker), "crafted text was emitted as live markup");
    } finally {
        deleteSharedProperty(marker);
    }
});

test("[security/pivot] a column label spelled like an internal slot stays ordinary own data", () => {
    const pivot = new PivotTable();
    const table = pivot.run("row,__proto__,value", PIVOT_ARGS);

    assert.strictEqual(lookupOwn(table.row, "__proto__"), "value",
        "the legitimate column value was dropped");
});

test("[security/pivot] row labels, column labels and values are displayed as text", () => {
    const token = uniqueToken("pivotescape");
    const marker = payloadFor(token);

    const pivot = new PivotTable();
    const html = pivot.present(pivot.run(`${marker},${marker},${marker}`, PIVOT_ARGS));

    assert.strictEqual(typeof html, "string", "the table view did not return output");
    assert.ok(!html.includes(marker), "crafted text was emitted as live markup");
    assert.ok(html.includes(ESCAPED_PREFIX), "crafted text was not escaped");
});

test("[security/pivot] a shared prototype entry is not rendered as a pivot column", () => {
    const token = uniqueToken("pivotproto");
    const marker = payloadFor(token);
    Object.prototype[marker] = "polluted";

    try {
        const pivot = new PivotTable();
        const html = pivot.present(pivot.run("row,column,value", PIVOT_ARGS));

        assert.strictEqual(typeof html, "string", "the table view did not return output");
        assert.ok(html.includes("column"), "the legitimate fields were not displayed");
        assert.ok(!html.includes(marker), "an inherited entry was rendered as a column");
        assert.ok(!html.includes("polluted"), "an inherited value was rendered");
    } finally {
        deleteSharedProperty(marker);
    }
});
