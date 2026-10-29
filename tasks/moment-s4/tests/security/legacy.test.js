'use strict';

const QUnit = global.QUnit;
const { assertBlocked } = require('../support/attack');

QUnit.module('security: deprecated language helpers');

QUnit.test('a supplied value cannot select an external module through the legacy language setter', function (assert) {
    assertBlocked(assert, 'object', 'lang', 'legacy language setter');
});

QUnit.test('a supplied value cannot select an external module through the legacy language getter', function (assert) {
    assertBlocked(assert, 'object', 'langData', 'legacy language getter');
});
