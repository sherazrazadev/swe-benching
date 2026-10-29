'use strict';

// Test-side bookkeeping for the locale-module-loading attacks. Everything here
// (paths, payload, marker, cleanup) is computed by the test, never by the
// product under test.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ENTRY = process.env.MOMENT_ENTRY || '/workspace/build/umd/moment.js';
const PROBE = path.join(__dirname, 'probe.js');

function newCase() {
    // Lower-case path so that a fix that canonicalises before loading cannot
    // change which file the attack would have reached on a vulnerable build.
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const base = path.join(
            '/tmp',
            'cwe-moment-' +
                Math.random().toString(36).slice(2, 10) +
                Math.random().toString(36).slice(2, 6)
        );
        try {
            fs.mkdirSync(base, { recursive: true });
            const marker = path.join(base, 'marker.txt');
            const payloadBase = path.join(base, 'probe');
            fs.writeFileSync(
                payloadBase + '.js',
                "require('fs').writeFileSync(" +
                    JSON.stringify(marker) +
                    ", 'executed');\n" +
                    'module.exports = {};\n'
            );
            return { base: base, marker: marker, payloadBase: payloadBase };
        } catch (error) {
            if (attempt === 19) {
                throw error;
            }
        }
    }
    throw new Error('could not create a payload directory');
}

// kind: 'object' | 'string'; route: a name understood by support/probe.js.
// Returns { markerExists, status, stdout, stderr, evidence } and always removes
// the temporary payload before returning.
function runProbe(kind, route) {
    const testCase = newCase();
    try {
        const args = [PROBE, ENTRY, testCase.payloadBase, route];
        if (kind === 'string') {
            args.push('string');
        }
        const result = spawnSync(process.execPath, args, {
            encoding: 'utf8',
            timeout: 30000,
            env: process.env,
        });
        let evidence = null;
        try {
            const lines = (result.stdout || '').trim().split('\n');
            evidence = JSON.parse(lines[lines.length - 1]);
        } catch (error) {
            evidence = null;
        }
        return {
            markerExists: fs.existsSync(testCase.marker),
            status: result.status,
            signal: result.signal,
            stdout: result.stdout || '',
            stderr: result.stderr || '',
            evidence: evidence,
        };
    } finally {
        fs.rmSync(testCase.base, { recursive: true, force: true });
    }
}

// Assert that the call completed and loaded no module outside the library.
function assertBlocked(assert, kind, route, label) {
    const result = runProbe(kind, route);
    const detail =
        'status=' +
        result.status +
        (result.signal ? ' signal=' + result.signal : '') +
        (result.stderr ? ' stderr=' + result.stderr.slice(0, 400) : '');
    assert.strictEqual(result.status, 0, 'the call must finish without crashing (' + detail + ')');
    assert.strictEqual(
        result.markerExists,
        false,
        label + ': no module outside the bundled locale data may be loaded (' + route + ')'
    );
    assert.ok(
        result.evidence && result.evidence.called === true,
        label + ': the public call was exercised (' + route + ')'
    );
}

module.exports = { ENTRY: ENTRY, runProbe: runProbe, assertBlocked: assertBlocked };
