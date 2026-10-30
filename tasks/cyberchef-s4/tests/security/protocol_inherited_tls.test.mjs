import test from "node:test";
import assert from "node:assert";

import ParseTLSRecord from "../../src/core/operations/ParseTLSRecord.mjs";
import {uniqueToken, payloadFor, deleteSharedProperty} from "../helpers.mjs";

// One ALERT record: type 21, version 0x0303, length 2, body 0x0228.
const ALERT_RECORD = new Uint8Array([0x15, 0x03, 0x03, 0x00, 0x02, 0x02, 0x28]).buffer;

test("[security/protocol] a shared prototype entry is not rendered as a TLS table field", () => {
    const token = uniqueToken("tls");
    const marker = payloadFor(token);
    Object.prototype[marker] = "polluted";

    try {
        const tls = new ParseTLSRecord();
        const html = tls.present(tls.run(ALERT_RECORD, []));

        assert.strictEqual(typeof html, "string", "the table view did not return output");
        assert.ok(html.includes("version"), "the legitimate fields were not displayed");
        assert.ok(!html.includes(marker), "an inherited entry was rendered as a table field");
        assert.ok(!html.includes("polluted"), "an inherited value was rendered");
    } finally {
        deleteSharedProperty(marker);
    }
});
