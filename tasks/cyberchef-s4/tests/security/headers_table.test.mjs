import test from "node:test";
import assert from "node:assert";

import ParseHTTPHeaders from "../../src/core/operations/ParseHTTPHeaders.mjs";
import {uniqueToken, payloadFor, ESCAPED_PREFIX, deleteSharedProperty} from "../helpers.mjs";

test("[security/headers] a shared prototype entry is not rendered as a header field", () => {
    const token = uniqueToken("headersproto");
    const marker = payloadFor(token);
    Object.prototype[marker] = "polluted";

    try {
        const headers = new ParseHTTPHeaders();
        const html = headers.present(headers.run("Content-Type: text/plain\nX-Trace: abc", ["Line feed"]));

        assert.strictEqual(typeof html, "string", "the table view did not return output");
        assert.ok(html.includes("Content-Type"), "the legitimate fields were not displayed");
        assert.ok(!html.includes(marker), "an inherited entry was rendered as a header field");
        assert.ok(!html.includes("polluted"), "an inherited value was rendered");
    } finally {
        deleteSharedProperty(marker);
    }
});

test("[security/headers] header names and values are displayed as text", () => {
    const token = uniqueToken("headersescape");
    const marker = payloadFor(token);

    const headers = new ParseHTTPHeaders();
    const html = headers.present(headers.run(`${marker}: ${marker}`, ["Line feed"]));

    assert.strictEqual(typeof html, "string", "the table view did not return output");
    assert.ok(!html.includes("<img"), "crafted text was emitted as live markup");
    assert.ok(!html.includes(marker), "crafted text was emitted as live markup");
    assert.ok(html.includes(ESCAPED_PREFIX), "crafted text was not escaped");
});
