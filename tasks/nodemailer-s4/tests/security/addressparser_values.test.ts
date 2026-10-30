import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import addressparser from '../../src/addressparser/index.js';
import { readMailbox, readOnlyRecipient } from '../support/mailbox.js';

/**
 * A value that names one mailbox must be parsed as that one mailbox. Whatever else the
 * value carries is display text; it must not end up in the address.
 */
function assertParsedMailbox(value: string, local: string, domain: string): void {
    const parsed = addressparser(value);
    assert.strictEqual(parsed.length, 1, `one entry for ${JSON.stringify(value)}`);

    const entry = parsed[0] as { address?: string; name?: string; group?: unknown };
    assert.strictEqual(entry.group, undefined, 'a mailbox, not a group');
    assert.ok(entry.address, `an address for ${JSON.stringify(value)}`);

    const parts = readMailbox(entry.address as string);
    assert.ok(parts, `one unambiguous mailbox for ${JSON.stringify(value)}, got ${JSON.stringify(entry.address)}`);
    assert.deepStrictEqual(parts, { local, domain }, `mailbox for ${JSON.stringify(value)}`);
}

describe('recipient values written as text', () => {
    it('a quoted mailbox followed by a comment and a second domain still names only its own domain', () => {
        assertParsedMailbox('"user"@good-corp.com(x)evil.com', 'user', 'good-corp.com');
    });

    it('a quoted mailbox followed by free text still names only its own domain', () => {
        assertParsedMailbox('"user"@good-corp.com evil.com', 'user', 'good-corp.com');
    });

    it('a quoted local part that contains a space keeps that space and drops the trailing text', () => {
        assertParsedMailbox('"user name"@good-corp.com(x)evil.com', 'user name', 'good-corp.com');
    });

    it('a quoted local part that contains an @ keeps the @ as local-part text', () => {
        assertParsedMailbox('"user@evil.com"@good-corp.com junk', 'user@evil.com', 'good-corp.com');
    });

    it('an empty quoted local part followed by a comment and a second domain keeps its empty local part', () => {
        assertParsedMailbox('""@good-corp.com(x)evil.com', '', 'good-corp.com');
    });

    it('repeated empty quoted strings are still an empty local part with one domain', () => {
        assertParsedMailbox('""""@good-corp.com(x)evil.com', '', 'good-corp.com');
    });

    it('several comments after the domain do not carry the text behind them into the address', () => {
        assertParsedMailbox('"user"@good-corp.com(x)(y)evil.com', 'user', 'good-corp.com');
    });

    it('a crafted entry in a list is read like the same entry on its own', () => {
        const parsed = addressparser('a@example.com, "user"@good-corp.com(x)evil.com');
        assert.strictEqual(parsed.length, 2);
        assert.deepStrictEqual(readMailbox((parsed[0] as { address: string }).address), {
            local: 'a',
            domain: 'example.com'
        });
        assert.deepStrictEqual(readMailbox((parsed[1] as { address: string }).address), {
            local: 'user',
            domain: 'good-corp.com'
        });
    });

    it('the whole list still denotes two recipients, one mailbox each', () => {
        const parsed = addressparser('a@example.com, "user"@good-corp.com(x)evil.com');
        const addresses = parsed.map(entry => (entry as { address: string }).address);
        assert.ok(readOnlyRecipient([addresses[0]]) !== null);
        assert.ok(readOnlyRecipient([addresses[1]]) !== null);
    });
});
