import {test} from 'node:test';
import assert from 'node:assert/strict';

const {JSONPath} = await import('jsonpath-plus');

const DATA = {
    store: {
        book: {price: 8},
        books: [{price: 12}, {price: 6}]
    }
};

const PATH = '$..[?(@.constructor.constructor("p","return p()")(probe))]';

test('a stored query cannot run code when it is evaluated later', () => {
    if (typeof JSONPath.prepare !== 'function') {
        // The package no longer offers ahead-of-time preparation, so the route is closed.
        assert.equal(JSONPath.prepare, undefined);
        return;
    }
    JSONPath.prepare(PATH);

    let ran = false;
    let error = null;
    try {
        JSONPath({
            json: DATA,
            path: PATH,
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
    assert.equal(ran, false, `the stored query ran code in the host process (${error ? error.message : 'no error'})`);
});
