import net from 'node:net';

export interface CaptureServer {
    port: number;
    lines: string[];
    close(): Promise<void>;
}

/**
 * A tiny SMTP server that records every command line and accepts everything, so a
 * test can read the exact recipient the client asked to deliver to. It speaks only
 * the commands the client sends (EHLO, MAIL FROM, RCPT TO, DATA, QUIT).
 */
export function startCaptureServer(): Promise<CaptureServer> {
    return new Promise((resolve, reject) => {
        const lines: string[] = [];
        const sockets = new Set<net.Socket>();
        const server = net.createServer(socket => {
            sockets.add(socket);
            socket.on('close', () => sockets.delete(socket));
            socket.on('error', () => undefined);

            let buffered = '';
            let inData = false;
            socket.write('220 test ESMTP\r\n');

            socket.on('data', chunk => {
                buffered += chunk.toString('binary');
                let index: number;
                while ((index = buffered.indexOf('\r\n')) !== -1) {
                    const line = buffered.slice(0, index);
                    buffered = buffered.slice(index + 2);
                    if (inData) {
                        if (line === '.') {
                            inData = false;
                            socket.write('250 2.0.0 OK\r\n');
                        }
                        continue;
                    }
                    lines.push(line);
                    if (/^EHLO\b/i.test(line)) {
                        socket.write('250-test\r\n250 PIPELINING\r\n');
                    } else if (/^MAIL FROM\b/i.test(line)) {
                        socket.write('250 2.1.0 Sender OK\r\n');
                    } else if (/^RCPT TO\b/i.test(line)) {
                        socket.write('250 2.1.5 Recipient OK\r\n');
                    } else if (/^DATA\b/i.test(line)) {
                        socket.write('354 Go ahead\r\n');
                        inData = true;
                    } else if (/^QUIT\b/i.test(line)) {
                        socket.write('221 Bye\r\n');
                        socket.end();
                    } else {
                        socket.write('250 OK\r\n');
                    }
                }
            });
        });

        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address() as net.AddressInfo;
            resolve({
                port: address.port,
                lines,
                close: () =>
                    new Promise<void>(done => {
                        for (const socket of sockets) {
                            socket.destroy();
                        }
                        server.close(() => done());
                    })
            });
        });
    });
}

/**
 * The address the client put between the angle brackets of its RCPT TO command.
 */
export function recipientCommands(lines: string[]): string[] {
    const out: string[] = [];
    for (const line of lines) {
        const match = /^RCPT TO:<([\s\S]*)>$/i.exec(line);
        if (match) {
            out.push(match[1]);
        }
    }
    return out;
}
