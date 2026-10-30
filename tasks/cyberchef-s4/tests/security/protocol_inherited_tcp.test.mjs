import test from "node:test";
import assert from "node:assert";

import ParseTCP from "../../src/core/operations/ParseTCP.mjs";
import {uniqueToken, payloadFor, deleteSharedProperty} from "../helpers.mjs";

// A TCP segment whose data offset covers a Maximum Segment Size option.
const PACKET_WITH_OPTIONS = "1a2b1a2b00000000000000007002000000000000020405b400000000";

test("[security/protocol] a shared prototype entry is not rendered as a TCP table field, including nested tables", () => {
    const token = uniqueToken("tcp");
    const marker = payloadFor(token);
    Object.prototype[marker] = "polluted";

    try {
        const tcp = new ParseTCP();
        const html = tcp.present(tcp.run(PACKET_WITH_OPTIONS, ["Hex"]));

        assert.strictEqual(typeof html, "string", "the table view did not return output");
        assert.ok(html.includes("Options"), "the legitimate nested fields were not displayed");
        assert.ok(html.includes("Maximum Segment Size"), "the legitimate nested option was not displayed");
        assert.ok(!html.includes(marker), "an inherited entry was rendered as a table field");
        assert.ok(!html.includes("polluted"), "an inherited value was rendered");
    } finally {
        deleteSharedProperty(marker);
    }
});
