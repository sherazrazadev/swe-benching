import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import MimeNode from '../../src/mime-node/index.js';
import { readMailbox } from '../support/mailbox.js';

const EXPECTED = { local: 'user', domain: 'good-corp.com' };

function assertOnlyRecipient(node: MimeNode, expected: { local: string; domain: string }): void {
    const recipients = node.getEnvelope().to;
    assert.strictEqual(recipients.length, 1, `recipient count: ${JSON.stringify(recipients)}`);
    assert.deepStrictEqual(readMailbox(recipients[0]), expected, `recipient: ${JSON.stringify(recipients[0])}`);
}

describe('recipients supplied as a ready address value', () => {
    it('an address value with a comment tail is delivered to its own mailbox only', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', { name: '', address: '"user"@good-corp.com(x)evil.com' });

        assertOnlyRecipient(node, EXPECTED);
    });

    it('an address value with a whitespace tail is delivered to its own mailbox only', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', { name: '', address: '"user"@good-corp.com evil.com' });

        assertOnlyRecipient(node, EXPECTED);
    });

    it('an explicit envelope address value with a comment tail is delivered to its own mailbox only', () => {
        const node = new MimeNode('text/plain');
        node.setEnvelope({ from: 'sender@example.com', to: [{ address: '"user"@good-corp.com(x)evil.com' }] });

        assertOnlyRecipient(node, EXPECTED);
    });

    it('an address value with an empty quoted local part keeps it empty and drops the trailing text', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', { name: '', address: '""@good-corp.com(x)evil.com' });

        assertOnlyRecipient(node, { local: '', domain: 'good-corp.com' });
    });

    it('a ready address value with a quoted local part also carries its trailing text as a name only', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', { name: '', address: '"user name"@good-corp.com(x)evil.com' });

        assertOnlyRecipient(node, { local: 'user name', domain: 'good-corp.com' });
    });
});
