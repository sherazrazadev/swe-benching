import {test} from 'node:test';
import assert from 'node:assert/strict';

const {JSONPath} = await import('jsonpath-plus');

const DATA = {
    store: {
        book: {price: 8},
        books: [{price: 12}, {price: 6}]
    }
};

/**
 * Runs a filter through the package's default evaluation mode and records
 * whether the expression managed to call the host function supplied in the
 * sandbox. The vulnerable implementation calls it; a safe one does not.
 * @param {string} expression Filter expression body.
 * @returns {{ran: boolean, error: Error|null}} What happened.
 */
function attempt (expression) {
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
    return {ran, error};
}

const shapes = [
    ['direct member access', '@.constructor.constructor("p","return p()")(probe)'],
    ['computed string member access', '@["constructor"].constructor("p","return p()")(probe)'],
    ['prototype identifier and descriptor lookup', 'constructor.getOwnPropertyDescriptor(constructor.getPrototypeOf(constructor), "constructor").value("p","return p()")(probe)'],
    ['computed array key', '@[["constructor"]][["constructor"]]("p","return p()")(probe)'],
    ['computed nested array key', '@[[["constructor"]]][[["constructor"]]]("p","return p()")(probe)'],
    ['inherited prototype member', '@.__proto__.constructor.constructor("p","return p()")(probe)'],
    ['computed prototype key', '@["__proto__"].constructor.constructor("p","return p()")(probe)']
];

for (const [name, expression] of shapes) {
    test(`default evaluation does not run the expression: ${name}`, () => {
        const {ran} = attempt(expression);
        assert.equal(ran, false, 'the filter expression ran code in the host process');
    });
}
