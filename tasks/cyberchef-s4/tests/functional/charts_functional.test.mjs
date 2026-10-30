import test from "node:test";
import assert from "node:assert";

import SeriesChart from "../../src/core/operations/SeriesChart.mjs";

const CHART_ARGS = ["Line feed", "Comma", "", 1, "red"];

test("[functional/charts] an ordinary series chart still renders", () => {
    const html = new SeriesChart().run("alpha,1,10\nbeta,2,20\nalpha,2,30", CHART_ARGS);

    assert.strictEqual(typeof html, "string");
    assert.match(html, /^<svg width/);
    assert.ok(html.includes("alpha"), "a legitimate series label was not displayed");
    assert.ok(html.includes("beta"), "a legitimate series label was not displayed");
});

test("[functional/charts] series and axis labels with spaces and punctuation still render", () => {
    const html = new SeriesChart().run("CPU load %,2024-01-01,10\nmem/qps,2024-01-02,20", CHART_ARGS);

    assert.strictEqual(typeof html, "string");
    assert.ok(html.includes("CPU load %"), "a legitimate series label was not displayed");
    assert.ok(html.includes("mem/qps"), "a legitimate series label was not displayed");
    assert.ok(html.includes("2024-01-01"), "a legitimate axis label was not displayed");
});

test("[functional/charts] the project's own x-axis escaping behaviour is preserved", () => {
    const html = new SeriesChart().run(
        `s,x"><script>globalThis.seriesChartInjected=1</script><g a=",1`,
        CHART_ARGS
    );

    assert.strictEqual(typeof html, "string");
    assert.ok(!html.includes("<script>"), "an x-axis label was serialized as live markup");
    assert.ok(!html.includes("__data__="), "d3 bound data leaked into the serialized chart");
});
