'use strict';

const QUnit = global.QUnit;
const { assertBlocked } = require('../support/attack');

QUnit.module('security: failed locale lookups');

QUnit.test('an unknown locale value cannot select an external module when locale data is read', function (assert) {
    assertBlocked(assert, 'string', 'localeData', 'locale data lookup after a miss');
});

QUnit.test('an unknown locale value cannot select an external module when the global locale is set', function (assert) {
    assertBlocked(assert, 'string', 'locale', 'global locale setter after a miss');
});
