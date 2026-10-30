import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import addressparser from '../../src/addressparser/index.js';
import MimeNode from '../../src/mime-node/index.js';
import { readMailbox } from '../support/mailbox.js';

function envelopeFor(value: string): string[] {
    const node = new MimeNode('text/plain');
    node.setHeader('From', 'sender@example.com');
    node.setHeader('To', value);
    return node.getEnvelope().to;
}

describe('recipient values that already work', () => {
    it('plain addresses and display names are delivered as before', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'Sender <sender@example.com>');
        node.setHeader('To', 'Plain <plain@example.com>, second@example.com');

        assert.deepStrictEqual(node.getEnvelope().to, ['plain@example.com', 'second@example.com']);
        assert.deepStrictEqual(node.getEnvelope().from, 'sender@example.com');
    });

    it('a comment after an ordinary address is its display name', () => {
        const parsed = addressparser('user@example.com (Support)');
        assert.strictEqual(parsed.length, 1);
        assert.strictEqual((parsed[0] as { address: string }).address, 'user@example.com');
        assert.strictEqual((parsed[0] as { name: string }).name, 'Support');
    });

    it('a quoted local part that carries a space keeps the space', () => {
        assert.deepStrictEqual(readMailbox(envelopeFor('"user name"@example.com')[0]), {
            local: 'user name',
            domain: 'example.com'
        });
    });

    it('a quoted local part that carries an escaped quote keeps it', () => {
        assert.deepStrictEqual(readMailbox(envelopeFor('"test\\"quote"@example.com')[0]), {
            local: 'test"quote',
            domain: 'example.com'
        });
    });

    it('a quoted local part that carries an @ keeps it as local-part text', () => {
        assert.deepStrictEqual(readMailbox(envelopeFor('"user@evil.example"@example.com')[0]), {
            local: 'user@evil.example',
            domain: 'example.com'
        });
    });

    it('quotes around a plain local part are optional', () => {
        assert.deepStrictEqual(readMailbox(envelopeFor('"user"@example.com')[0]), {
            local: 'user',
            domain: 'example.com'
        });
    });

    it('groups deliver each of their members', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', 'Team: first@example.com, second@example.com;');

        assert.deepStrictEqual(node.getEnvelope().to, ['first@example.com', 'second@example.com']);
    });

    it('an explicit envelope keeps bare local usernames and every recipient', () => {
        const node = new MimeNode('text/plain');
        node.setEnvelope({
            from: 'sender@example.com',
            to: ['root'],
            cc: ['first@example.com'],
            bcc: ['second@example.com']
        });

        assert.deepStrictEqual(node.getEnvelope().to, ['root', 'first@example.com', 'second@example.com']);
    });

    it('ready address values are delivered like the same value written as text', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', [
            { name: 'Plain', address: 'plain@example.com' },
            { name: 'Spaced', address: '"user name"@example.com' },
            { name: '', address: '"user@evil.example"@example.com' }
        ]);

        assert.deepStrictEqual(node.getEnvelope().to, [
            'plain@example.com',
            '"user name"@example.com',
            '"user@evil.example"@example.com'
        ]);
    });

    it('the visible header and the envelope still agree on the recipients', () => {
        const node = new MimeNode('text/plain');
        node.setHeader('From', 'sender@example.com');
        node.setHeader('To', 'A <a@example.com>, b@example.com, "user name"@example.com');

        const header = node.getHeader('To') as string;
        const reparsed = addressparser(header).map(entry => (entry as { address: string }).address);
        assert.deepStrictEqual(reparsed, node.getEnvelope().to);
    });
});
