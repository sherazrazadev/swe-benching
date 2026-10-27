import {test} from 'node:test';
import assert from 'node:assert/strict';

const DATA = {
    store: {
        book: {price: 8},
        books: [{price: 12}, {price: 6}]
    }
};

const shapes = [
    ['direct member access', '@.constructor.constructor("p","return p()")(probe)'],
    ['prototype identifier and descriptor lookup', 'constructor.getOwnPropertyDescriptor(constructor.getPrototypeOf(constructor), "constructor").value("p","return p()")(probe)']
];

let JSONPath;
let available = true;
try {
    ({JSONPath} = await import('jsonpath-plus/edge'));
} catch {
    available = false;
}

if (!available) {
    test('the build shipped for other runtimes does not run the expression', () => {
        // The package no longer ships that build, so the route is closed.
        assert.equal(JSONPath, undefined);
    });
} else {
    for (const [name, expression] of shapes) {
        test(`the build shipped for other runtimes does not run the expression: ${name}`, () => {
            let ran = false;
            let error = null;
            try {
                JSONPath({
                    json: DATA,
                    path: '$..[?(' + expression + ')]',
                    sandbox: {
                        probe () {
                            ran = true;
                            return true;
                        }
                    }
                });
            } catch (e) {
                error = e;
            }
            assert.equal(ran, false, `the other-runtime build ran code in the host process (${error ? error.message : 'no error'})`);
        });
    }
}
