import test from "node:test";
import assert from "node:assert";

import {objToTable} from "../../src/core/lib/Protocol.mjs";

test("[functional/table] scalar field values still display", () => {
    const html = objToTable({count: 5, ready: false, name: "sample"});

    assert.strictEqual(typeof html, "string");
    assert.ok(html.includes("count"));
    assert.ok(html.includes("5"));
    assert.ok(html.includes("false"));
    assert.ok(html.includes("sample"));
});

test("[functional/table] nested objects still display as sub-tables", () => {
    const html = objToTable({outer: {inner: "deep"}, top: "value"});

    assert.strictEqual(typeof html, "string");
    assert.ok(html.includes("outer"));
    assert.ok(html.includes("inner"));
    assert.ok(html.includes("deep"));
    assert.ok((html.match(/<table/g) || []).length >= 2, "a nested object was not expanded into a sub-table");
});

test("[functional/table] an empty value does not break the table", () => {
    const html = objToTable({empty: null, kept: "value"});

    assert.strictEqual(typeof html, "string");
    assert.ok(html.includes("empty"));
    assert.ok(html.includes("kept"));
});
