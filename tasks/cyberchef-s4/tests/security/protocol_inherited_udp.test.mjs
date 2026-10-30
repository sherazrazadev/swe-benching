import test from "node:test";
import assert from "node:assert";

import ParseUDP from "../../src/core/operations/ParseUDP.mjs";
import {uniqueToken, payloadFor, deleteSharedProperty} from "../helpers.mjs";

const BENIGN_PACKET = "1a2b1a2b00080000";

test("[security/protocol] a shared prototype entry is not rendered as a UDP table field", () => {
    const token = uniqueToken("udp");
    const marker = payloadFor(token);
    Object.prototype[marker] = "polluted";

    try {
        const udp = new ParseUDP();
        const html = udp.present(udp.run(BENIGN_PACKET, ["Hex"]));

        assert.strictEqual(typeof html, "string", "the table view did not return output");
        assert.ok(html.includes("Source port"), "the legitimate fields were not displayed");
        assert.ok(!html.includes(marker), "an inherited entry was rendered as a table field");
        assert.ok(!html.includes("polluted"), "an inherited value was rendered");
    } finally {
        deleteSharedProperty(marker);
    }
});
