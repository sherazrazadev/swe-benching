'use strict';

const QUnit = global.QUnit;
const { assertBlocked } = require('../support/attack');

QUnit.module('security: reported locale resolution APIs');

QUnit.test('a supplied value cannot select an external module when locale data is read', function (assert) {
    assertBlocked(assert, 'object', 'localeData', 'locale data lookup');
});

QUnit.test('a supplied value cannot select an external module when the global locale is set', function (assert) {
    assertBlocked(assert, 'object', 'locale', 'global locale setter');
});

QUnit.test('a supplied value cannot select an external module on an instance', function (assert) {
    assertBlocked(assert, 'object', 'instanceLocale', 'instance locale setter');
});

QUnit.test('a supplied value cannot select an external module when parsing', function (assert) {
    assertBlocked(assert, 'object', 'constructorLocale', 'parse-time locale');
});
