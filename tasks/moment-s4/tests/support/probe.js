'use strict';

// Invoke one public locale API with a caller-supplied value in a fresh process.
// argv: <moment entry> <payload path without extension> <route> [string]
// Prints one JSON line; exits non-zero only if the library itself cannot load.

const path = require('path');

const entry = process.argv[2];
const payloadBase = process.argv[3];
const route = process.argv[4];
const asString = process.argv[5] === 'string';

const moment = require(entry);
moment.suppressDeprecationWarnings = true;

const relative = path
    .relative(path.join(path.dirname(entry), 'locale'), payloadBase)
    .replace(/\\/g, '/');

const value = asString
    ? relative
    : {
          match: function () {
              return [''];
          },
          indexOf: function () {
              return -1;
          },
          toString: function () {
              return relative;
          },
      };

let threw = null;
try {
    switch (route) {
        case 'localeData':
            moment.localeData(value);
            break;
        case 'locale':
            moment.locale(value);
            break;
        case 'instanceLocale':
            moment().locale(value);
            break;
        case 'constructorLocale':
            moment('2020-01-01', 'YYYY-MM-DD', value);
            break;
        case 'updateLocale':
            moment.updateLocale(value, { months: ['M'] });
            break;
        case 'defineParent':
            moment.defineLocale('cwe-probe-parent', {
                parentLocale: value,
                months: ['M'],
            });
            break;
        case 'localeConfig':
            moment.locale('cwe-probe-config', {
                parentLocale: value,
                months: ['M'],
            });
            break;
        case 'lang':
            moment.lang(value);
            break;
        case 'langData':
            moment.langData(value);
            break;
        default:
            throw new Error('unknown route: ' + route);
    }
} catch (error) {
    threw = error && error.message;
}

process.stdout.write(
    JSON.stringify({ route: route, asString: asString, threw: threw, called: true }) + '\n'
);
