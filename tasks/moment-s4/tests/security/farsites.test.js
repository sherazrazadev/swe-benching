'use strict';

const QUnit = global.QUnit;
const { assertBlocked } = require('../support/attack');

QUnit.module('security: locale merge and registration');

QUnit.test('a supplied value cannot select an external module when a locale is updated', function (assert) {
    assertBlocked(assert, 'object', 'updateLocale', 'locale update');
});

QUnit.test('a supplied value cannot select an external module as a parent locale', function (assert) {
    assertBlocked(assert, 'object', 'defineParent', 'locale registration');
});

QUnit.test('a supplied value cannot select an external module through a locale configuration', function (assert) {
    assertBlocked(assert, 'object', 'localeConfig', 'global setter with configuration');
});
