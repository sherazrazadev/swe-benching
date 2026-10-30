import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import SMTPConnection from '../../src/smtp-connection/index.js';
import { startCaptureServer, recipientCommands } from '../support/smtp.js';
import { readMailbox } from '../support/mailbox.js';

describe('the delivery command sent to the mail server', () => {
    it('keeps a quoted local part as one mailbox when it carries an @', async () => {
        const server = await startCaptureServer();
        const connection = new SMTPConnection({
            host: '127.0.0.1',
            port: server.port,
            secure: false,
            ignoreTLS: true,
            tls: { rejectUnauthorized: false }
        });

        try {
            await new Promise<void>((resolve, reject) =>
                connection.connect(err => (err ? reject(err) : resolve()))
            );
            await new Promise<void>((resolve, reject) =>
                connection.send(
                    { from: 'sender@example.com', to: ['"user@evil.com"@good-corp.com'] },
                    'Subject: test\r\n\r\nbody',
                    err => (err ? reject(err) : resolve())
                )
            );

            const commands = recipientCommands(server.lines);
            assert.strictEqual(commands.length, 1, `delivery commands: ${JSON.stringify(commands)}`);
            assert.deepStrictEqual(readMailbox(commands[0]), { local: 'user@evil.com', domain: 'good-corp.com' });
        } finally {
            connection.close();
            await server.close();
        }
    });
});
