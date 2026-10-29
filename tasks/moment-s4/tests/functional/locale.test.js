'use strict';

const QUnit = global.QUnit;
const moment = require(process.env.MOMENT_ENTRY || '/workspace/build/umd/moment.js');

QUnit.module('functional: locale resolution', {
    beforeEach: function () {
        moment.locale('en');
    },
    afterEach: function () {
        moment.locale('en');
    },
});

QUnit.test('bundled locales load and become the current locale', function (assert) {
    ['en', 'fr', 'en-gb', 'de', 'zh-cn'].forEach(function (name) {
        assert.strictEqual(moment.locale(name), name, name + ' should load');
    });
});

QUnit.test('locale names are matched without regard to case', function (assert) {
    assert.strictEqual(moment.locale('EN'), 'en');
    assert.strictEqual(moment.locale('DE'), 'de');
});

QUnit.test('underscore-separated locale names are matched', function (assert) {
    assert.strictEqual(moment.locale('EN_gb'), 'en-gb');
});

QUnit.test('a more general locale is used when a specific one does not exist', function (assert) {
    assert.strictEqual(moment.locale('fr-crap'), 'fr');
    assert.strictEqual(moment.locale('fr-CA-does-not-exist'), 'fr-ca');
});

QUnit.test('a list of locale names uses the first one that exists', function (assert) {
    assert.strictEqual(
        moment.locale(['non-existent-locale', 'fr', 'also-non-existent']),
        'fr'
    );
});

QUnit.test('an unknown name is simply not found, however long', function (assert) {
    assert.strictEqual(moment.locale('nonexistent-' + 'x'.repeat(200)), 'en');
});

QUnit.test('a custom locale registered under an exact name resolves by that name', function (assert) {
    moment.defineLocale('Mixed_Custom', { months: ['Movember'] });
    try {
        assert.strictEqual(
            moment.localeData('Mixed_Custom')._abbr,
            'Mixed_Custom'
        );
        assert.strictEqual(moment.locale('Mixed_Custom'), 'Mixed_Custom');
    } finally {
        moment.defineLocale('Mixed_Custom', null);
    }
});

QUnit.test('updating a locale keeps the configuration it inherits', function (assert) {
    moment.updateLocale('de', { monthsShort: ['JAN'] });
    try {
        const locale = moment.localeData('de');
        assert.strictEqual(
            locale.months(moment.utc([2017, 0])),
            'Januar',
            'the merged locale still inherits its months'
        );
        assert.strictEqual(locale._abbr, 'de');
    } finally {
        moment.updateLocale('de', null);
    }
});

QUnit.test('a child locale with a parent loads the parent', function (assert) {
    moment.defineLocale('de_test', {
        parentLocale: 'de',
        monthsShort: [
            'M1', 'M2', 'M3', 'M4', 'M5', 'M6',
            'M7', 'M8', 'M9', 'M10', 'M11', 'M12',
        ],
    });
    try {
        assert.strictEqual(moment.locale(), 'de_test');
        assert.strictEqual(
            moment.localeData('de_test').monthsShort(moment.utc([2017, 0])),
            'M1'
        );
    } finally {
        moment.defineLocale('de_test', null);
    }
});

QUnit.test('the deprecated language helpers still load and select a locale', function (assert) {
    assert.strictEqual(moment.lang('fr'), 'fr');
    assert.strictEqual(moment.langData('fr')._abbr, 'fr');
});

QUnit.test('the deprecated data getter returns the locale it was asked for', function (assert) {
    moment.locale('de');
    moment.locale('en');
    assert.strictEqual(moment.langData('de')._abbr, 'de');
});
