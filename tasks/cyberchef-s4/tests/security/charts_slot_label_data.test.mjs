import test from "node:test";
import assert from "node:assert";

import {getSeriesValues} from "../../src/core/lib/Charts.mjs";
import {lookupOwn} from "../helpers.mjs";

test("[security/charts] a series named like an internal slot stays ordinary series data", () => {
    try {
        const result = getSeriesValues("__proto__,x,1", "\n", ",", false);

        assert.strictEqual(result.series.length, 1, "the legitimate series was dropped");
        assert.strictEqual(result.series[0].name, "__proto__", "the legitimate series name was changed");
        assert.strictEqual(lookupOwn(result.series[0].data, "x"), 1,
            "the legitimate series value was dropped");
        assert.strictEqual(Object.prototype.x, undefined,
            "processing the data changed an object shared by every operation");
    } finally {
        delete Object.prototype.x;
    }
});

test("[security/charts] an x label named like an internal slot stays ordinary own data", () => {
    const result = getSeriesValues("series,__proto__,1", "\n", ",", false);

    assert.strictEqual(result.series.length, 1, "the legitimate series was dropped");
    assert.strictEqual(lookupOwn(result.series[0].data, "__proto__"), 1,
        "the legitimate x-axis value was dropped");
});
