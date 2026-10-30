import test from "node:test";
import assert from "node:assert";

import ParseUDP from "../../src/core/operations/ParseUDP.mjs";
import ParseTCP from "../../src/core/operations/ParseTCP.mjs";
import ParseTLSRecord from "../../src/core/operations/ParseTLSRecord.mjs";

test("[functional/protocol] an ordinary UDP packet is still shown as a table", () => {
    const udp = new ParseUDP();
    const html = udp.present(udp.run("1a2b1a2b00080000", ["Hex"]));

    assert.strictEqual(typeof html, "string");
    for (const field of ["Source port", "Destination port", "Length", "Checksum"]) {
        assert.ok(html.includes(field), `the ${field} field was not displayed`);
    }
    assert.ok(html.includes("6699"), "the parsed port value was not displayed");
});

test("[functional/protocol] an ordinary TCP packet still shows nested option fields", () => {
    const tcp = new ParseTCP();
    const html = tcp.present(tcp.run("1a2b1a2b00000000000000007002000000000000020405b400000000", ["Hex"]));

    assert.strictEqual(typeof html, "string");
    assert.ok(html.includes("Options"), "the nested options field was not displayed");
    assert.ok(html.includes("Maximum Segment Size"), "a nested option was not displayed");
    assert.ok(html.includes("Flags"), "the nested flags field was not displayed");
    assert.ok((html.match(/<table/g) || []).length >= 3, "nested objects were not expanded into sub-tables");
});

test("[functional/protocol] an ordinary TLS record is still shown as a table", () => {
    const tls = new ParseTLSRecord();
    const record = new Uint8Array([0x15, 0x03, 0x03, 0x00, 0x02, 0x02, 0x28]).buffer;
    const html = tls.present(tls.run(record, []));

    assert.strictEqual(typeof html, "string");
    assert.ok(html.includes("type"), "the record type field was not displayed");
    assert.ok(html.includes("alert"), "the record type value was not displayed");
    assert.ok(html.includes("0x0303"), "the record version was not displayed");
});
