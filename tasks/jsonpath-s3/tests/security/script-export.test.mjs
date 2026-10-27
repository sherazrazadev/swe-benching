import {test} from 'node:test';
import assert from 'node:assert/strict';

const pkg = await import('jsonpath-plus');

test('a standalone expression evaluator exposed by the package does not run code', () => {
    const Exported = pkg.SafeScript;
    if (typeof Exported !== 'function') {
        // The package no longer exposes that evaluator, so the route is closed.
        assert.equal(Exported, undefined);
        return;
    }
    let ran = false;
    let error = null;
    try {
        const script = new Exported(
            'constructor.getOwnPropertyDescriptor(constructor.getPrototypeOf(constructor), "constructor").value("p","return p()")(probe)'
        );
        script.runInNewContext({
            probe () {
                ran = true;
                return true;
            }
        });
    } catch (e) {
        error = e;
    }
    assert.equal(ran, false, `the exposed evaluator ran code in the host process (${error ? error.message : 'no error'})`);
});
