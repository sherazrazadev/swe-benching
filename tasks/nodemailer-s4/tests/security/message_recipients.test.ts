import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import MimeNode from '../../src/mime-node/index.js';
import { readMailbox } from '../support/mailbox.js';

const CRAFTED = '"user"@good-corp.com(x)evil.com';
const EXPECTED = { local: 'user', domain: 'good-corp.com' };

function assertEnvelopeRecipients(recipients: string[], expected: { local: string; domain: string }[]): void {
    assert.strictEqual(recipients.length, expected.length, `recipient count: ${JSON.stringify(recipients)}`);
    for (let i = 0; i < recipients.length; i++) {
        assert.deepStrictEqual(readMailbox(recipients[i]), expected[i], `recipient ${i}: ${JSON.stringify(recipients[i])}`);
    }
}

describe('envelope recipients built from a message', () => {
    it('a crafted To value is delivered to its own mailbox only', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', CRAFTED);

        assertEnvelopeRecipients(node.getEnvelope().to, [EXPECTED]);
    });

    it('a crafted Cc value is delivered to its own mailbox only', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('Cc', CRAFTED);

        assertEnvelopeRecipients(node.getEnvelope().to, [EXPECTED]);
    });

    it('a crafted Bcc value is delivered to its own mailbox only', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('Bcc', CRAFTED);

        assertEnvelopeRecipients(node.getEnvelope().to, [EXPECTED]);
    });

    it('a crafted value among several recipients does not change the others', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', 'first@example.com, ' + CRAFTED + ', third@example.com');

        assertEnvelopeRecipients(node.getEnvelope().to, [
            { local: 'first', domain: 'example.com' },
            EXPECTED,
            { local: 'third', domain: 'example.com' }
        ]);
    });

    it('a crafted value supplied as an explicit envelope recipient is delivered to its own mailbox only', () => {
        const node = new MimeNode('text/plain');
        node.setEnvelope({
            from: 'sender@example.com',
            to: [CRAFTED],
            cc: [CRAFTED],
            bcc: [CRAFTED]
        });

        assertEnvelopeRecipients(node.getEnvelope().to, [EXPECTED]);
    });

    it('a crafted value with a whitespace tail is delivered to its own mailbox only', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', '"user"@good-corp.com evil.com');

        assertEnvelopeRecipients(node.getEnvelope().to, [EXPECTED]);
    });

    it('a quoted local part that contains a space keeps it in the delivery address', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', '"user name"@good-corp.com(x)evil.com');

        assertEnvelopeRecipients(node.getEnvelope().to, [{ local: 'user name', domain: 'good-corp.com' }]);
    });
});
