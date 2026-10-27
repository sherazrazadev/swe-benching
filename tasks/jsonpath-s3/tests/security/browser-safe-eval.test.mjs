import {test} from 'node:test';
import assert from 'node:assert/strict';

const {JSONPath} = await import('../../dist/index-browser-esm.js');

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

for (const [name, expression] of shapes) {
    test(`the browser build does not run the expression: ${name}`, () => {
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
        assert.equal(ran, false, `the browser build ran code in the host process (${error ? error.message : 'no error'})`);
    });
}
