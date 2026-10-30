import test from "node:test";
import assert from "node:assert";

import ParseHTTPHeaders from "../../src/core/operations/ParseHTTPHeaders.mjs";

test("[functional/headers] ordinary headers are still shown as a table", () => {
    const headers = new ParseHTTPHeaders();
    const data = headers.run(
        "Host: example.test\nContent-Type: text/html; charset=utf-8\nX-Empty:",
        ["Line feed"]
    );
    const html = headers.present(data);

    assert.strictEqual(typeof html, "string");
    assert.ok(html.includes("Host"), "a legitimate header name was not displayed");
    assert.ok(html.includes("example.test"), "a legitimate header value was not displayed");
    assert.ok(html.includes("text/html; charset=utf-8"), "a legitimate header value was not displayed");
    assert.ok((html.match(/<tr>/g) || []).length >= 4, "the header table was not produced");
});

test("[functional/headers] lines without a colon are ignored but other headers still render", () => {
    const headers = new ParseHTTPHeaders();
    const data = headers.run("not a header\nX-Real: kept", ["Line feed"]);
    const html = headers.present(data);

    assert.ok(html.includes("X-Real"), "a legitimate header was dropped");
    assert.ok(html.includes("kept"), "a legitimate header value was dropped");
    assert.ok(!html.includes("not a header"), "a non-header line was treated as a field");
});
