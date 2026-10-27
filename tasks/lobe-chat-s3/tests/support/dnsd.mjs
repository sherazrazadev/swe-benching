import dgram from 'node:dgram';
import fs from 'node:fs';
import net from 'node:net';

const [, , tablePath, logPath, portArg] = process.argv;
const port = Number(portArg || 53);
const raw = JSON.parse(fs.readFileSync(tablePath, 'utf8'));
const records = new Map();
for (const [host, record] of Object.entries(raw.dns || {})) records.set(host.toLowerCase(), record);

function log(line) {
  if (!logPath) return;
  try { fs.appendFileSync(logPath, line + '\n'); } catch { /* best effort */ }
}

function parseQuestion(message) {
  let offset = 12;
  const labels = [];
  while (offset < message.length) {
    const length = message[offset];
    if (length === 0) { offset += 1; break; }
    labels.push(message.subarray(offset + 1, offset + 1 + length).toString('latin1'));
    offset += 1 + length;
  }
  const type = message.readUInt16BE(offset);
  return { name: labels.join('.').toLowerCase(), type, end: offset + 4 };
}

function ipv4Bytes(address) { return address.split('.').map(Number); }

function ipv6Bytes(address) {
  const [head, tail] = address.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = address.includes('::') ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  const bytes = [];
  for (const group of groups) { const value = parseInt(group || '0', 16); bytes.push((value >> 8) & 0xff, value & 0xff); }
  return bytes;
}

function answerFor(name, type) {
  const record = records.get(name);
  if (!record) return { code: 3, answers: [] };
  const answers = [];
  if (type === 1 && record.A) {
    answers.push({ type: 1, data: Buffer.from(ipv4Bytes(record.A)) });
  } else if (type === 28 && record.AAAA) {
    answers.push({ type: 28, data: Buffer.from(ipv6Bytes(record.AAAA)) });
  }
  return { code: 0, answers };
}

const socket = dgram.createSocket('udp4');
socket.on('message', (message, remote) => {
  try {
    if (message.length < 12) return;
    const { name, type, end } = parseQuestion(message);
    log(`${name} ${type}`);
    const { code, answers } = answerFor(name, type);
    const header = Buffer.alloc(12);
    message.copy(header, 0, 0, 2);
    header.writeUInt16BE(0x8180 | code, 2);
    header.writeUInt16BE(1, 4);
    header.writeUInt16BE(answers.length, 6);
    const question = message.subarray(12, end);
    const parts = [header, question];
    for (const answer of answers) {
      const fixed = Buffer.alloc(12);
      fixed.writeUInt16BE(0xc00c, 0);
      fixed.writeUInt16BE(answer.type, 2);
      fixed.writeUInt16BE(1, 4);
      fixed.writeUInt32BE(60, 6);
      fixed.writeUInt16BE(answer.data.length, 10);
      parts.push(fixed, answer.data);
    }
    socket.send(Buffer.concat(parts), remote.port, remote.address);
  } catch (error) {
    log(`error ${error && error.message}`);
  }
});
socket.bind(port, '127.0.0.1', () => log(`listening ${port}`));
