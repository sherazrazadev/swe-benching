import test from "node:test";
import assert from "node:assert";

import SeriesChart from "../../src/core/operations/SeriesChart.mjs";
import {uniqueToken, payloadFor, deleteSharedProperty} from "../helpers.mjs";

const CHART_ARGS = ["Line feed", "Comma", "", 1, "red"];

test("[security/charts] a series name spelled like an internal slot does not modify shared objects", () => {
    const token = uniqueToken("seriesproto");
    const marker = payloadFor(token);
    deleteSharedProperty(marker);

    try {
        const html = new SeriesChart().run(`__proto__,${marker},1`, CHART_ARGS);

        assert.strictEqual(typeof html, "string", "the chart operation did not return output");
        assert.ok(html.length > 0, "the chart operation returned empty output");

        assert.strictEqual(Object.prototype[marker], undefined,
            "processing the data changed an object shared by every operation");
        assert.ok(!html.includes(marker), "crafted text was emitted as live markup");
    } finally {
        deleteSharedProperty(marker);
    }
});

test("[security/charts] a series name spelled like a built-in member does not modify built-in objects", () => {
    const token = uniqueToken("ctorproto");
    const marker = payloadFor(token);
    deleteSharedProperty(marker);

    try {
        const html = new SeriesChart().run(`constructor,${marker},1`, CHART_ARGS);

        assert.strictEqual(typeof html, "string", "the chart operation did not return output");
        assert.ok(html.length > 0, "the chart operation returned empty output");

        assert.strictEqual(Object[marker], undefined,
            "processing the data changed a built-in object");
        assert.ok(!html.includes(marker), "crafted text was emitted as live markup");
    } finally {
        deleteSharedProperty(marker);
    }
});
