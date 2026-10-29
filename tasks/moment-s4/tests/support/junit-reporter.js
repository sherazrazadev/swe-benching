'use strict';

// Minimal JUnit XML reporter for the QUnit CLI. Writes one <testcase> per QUnit
// test to the path in JUNIT_OUT. Kept in the test tree (never in the image).

const fs = require('fs');

function esc(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

module.exports = {
    init: function (QUnit) {
        var cases = [];

        QUnit.on('testEnd', function (test) {
            var fullName = test.fullName || [];
            var classname =
                fullName.length > 1
                    ? fullName.slice(0, -1).join(' > ')
                    : test.suiteName || 'tests';
            var name =
                fullName.length > 0
                    ? fullName[fullName.length - 1]
                    : test.name || 'test';
            var errors = (test.errors || []).map(function (error) {
                return [error.message, error.stack]
                    .filter(Boolean)
                    .join('\n');
            });
            cases.push({
                classname: classname || 'tests',
                name: name,
                status: test.status,
                errors: errors,
            });
        });

        QUnit.on('runEnd', function () {
            var out = process.env.JUNIT_OUT;
            if (!out) {
                return;
            }
            var failures = cases.filter(function (c) {
                return c.status !== 'passed' && c.status !== 'skipped';
            }).length;
            var skipped = cases.filter(function (c) {
                return c.status === 'skipped';
            }).length;
            var lines = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<testsuites>',
                '<testsuite name="moment-s4" tests="' +
                    cases.length +
                    '" failures="' +
                    failures +
                    '" errors="0" skipped="' +
                    skipped +
                    '">',
            ];
            cases.forEach(function (c) {
                lines.push(
                    '<testcase classname="' +
                        esc(c.classname) +
                        '" name="' +
                        esc(c.name) +
                        '">'
                );
                if (c.status === 'skipped') {
                    lines.push('<skipped/>');
                } else if (c.status !== 'passed' || c.errors.length) {
                    var message = c.errors.length
                        ? c.errors[0].split('\n')[0]
                        : 'test failed';
                    lines.push(
                        '<failure message="' +
                            esc(message) +
                            '">' +
                            esc(c.errors.join('\n')) +
                            '</failure>'
                    );
                }
                lines.push('</testcase>');
            });
            lines.push('</testsuite>', '</testsuites>');
            fs.writeFileSync(out, lines.join('\n'));
        });
    },
};
