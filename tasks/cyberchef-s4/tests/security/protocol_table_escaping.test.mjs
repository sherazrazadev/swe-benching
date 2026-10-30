import test from "node:test";
import assert from "node:assert";

import {objToTable} from "../../src/core/lib/Protocol.mjs";
import {uniqueToken, payloadFor, ESCAPED_PREFIX} from "../helpers.mjs";

test("[security/protocol] table field names and values are displayed as text", () => {
    const token = uniqueToken("escape");
    const marker = payloadFor(token);
    const name = `<b>${token}</b>`;

    const html = objToTable({
        [name]: marker,
        safe: "value"
    });

    assert.strictEqual(typeof html, "string", "the table view did not return output");
    assert.ok(html.includes("safe"), "the legitimate field was not displayed");
    assert.ok(!html.includes(name), "a field name was emitted as live markup");
    assert.ok(!html.includes(marker), "a field value was emitted as live markup");
    assert.ok(html.includes(ESCAPED_PREFIX), "the field value was not escaped");
    assert.ok(html.includes("&lt;b&gt;"), "the field name was not escaped");
});
