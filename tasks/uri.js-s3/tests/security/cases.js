'use strict';

/*
 * Security cases: whatever string the caller supplies, the host the library reports — directly
 * or when resolving a reference from a base — must be the host a standards-compliant browser
 * reaches for that same string, and a same-site decision must not be fooled by the authority's
 * spelling. Each case drives a public entry point and compares against a literal.
 */

const BASE = 'https://victim.example/app/';
const ATTACKER = 'attacker.example';

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
}

module.exports = function ({ URI, bundle }) {
  const cases = [];

  function security(className, name, run) {
    cases.push({ classname: 'security/' + className, name, run });
  }

  // -- the scheme delimiter of an absolute web location -------------------------------

  security('scheme', 'a web location with no separator still names its host', () => {
    eq(URI('https:' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('scheme', 'a web location with one separator still names its host', () => {
    eq(URI('https:/' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('scheme', 'a separator written with both separators still names its host', () => {
    eq(URI('https:/\\/\\' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('scheme', 'a differently capitalised web scheme still names its host', () => {
    eq(URI('hTTps:' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('scheme', 'a transfer scheme with no separator still names its host', () => {
    eq(URI('ftp:' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('scheme', 'a socket scheme with one separator still names its host', () => {
    eq(URI('wss:/' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('scheme', 'the documented parse entry reports the same host', () => {
    eq(URI.parse('https:' + ATTACKER).hostname, ATTACKER, 'hostname');
  });

  security('scheme', 'replacing the address of a URI reports the same host', () => {
    eq(URI('http://victim.example/').href('https:' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('scheme', 'setting a URI from a location reports the same origin', () => {
    eq(URI('http://victim.example/').origin('https:' + ATTACKER).origin(),
      'https://' + ATTACKER, 'origin');
  });

  // -- which site a reference resolves to ---------------------------------------------

  const references = [
    ['////' + ATTACKER + '/x', 'excess forward separators'],
    ['\\\\' + ATTACKER + '/x', 'a pair of back separators'],
    ['/\\' + ATTACKER + '/x', 'forward then back'],
    ['\\/' + ATTACKER + '/x', 'back then forward'],
    ['///' + ATTACKER + '/x', 'three forward separators'],
  ];
  for (const [input, label] of references) {
    security('reference', `${label} resolves to the host the browser reaches`, () => {
      eq(URI(input, BASE).hostname(), ATTACKER, 'resolved hostname');
    });
    security('reference', `${label} resolves to that host through the absolute form`, () => {
      eq(URI(input).absoluteTo(BASE).hostname(), ATTACKER, 'absoluteTo hostname');
    });
  }

  security('reference', 'a resolved reference reports the host in its origin', () => {
    eq(URI('////' + ATTACKER + '/x', BASE).origin(), 'https://' + ATTACKER, 'origin');
  });

  // -- the shipped browser build carries its own parser -------------------------------

  security('bundle', 'the shipped build names the host of a location with no separator', () => {
    eq(bundle()('https:' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('bundle', 'the shipped build names the host of a location with one separator', () => {
    eq(bundle()('https:/' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('bundle', 'the shipped build names the host of an over-separated location', () => {
    eq(bundle()('https://////' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('bundle', 'the shipped build names the host of a capitalised web scheme', () => {
    eq(bundle()('hTTps://////' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('bundle', 'the shipped build names the host of a mixed separator run', () => {
    eq(bundle()('https:/\\/\\' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('bundle', 'the shipped build names the host of an over-separated transfer location', () => {
    eq(bundle()('ftp:////' + ATTACKER).hostname(), ATTACKER, 'hostname');
  });

  security('bundle', 'the shipped build resolves an over-separated reference off-site', () => {
    eq(bundle()('////' + ATTACKER + '/x', BASE).hostname(), ATTACKER, 'hostname');
  });

  security('bundle', 'the shipped build resolves a back-separated reference off-site', () => {
    eq(bundle()('\\\\' + ATTACKER + '/x', BASE).hostname(), ATTACKER, 'hostname');
  });

  // -- same-site decisions ------------------------------------------------------------

  security('comparison', 'credentials spelled like the base host do not make the target local', () => {
    eq(URI.isSameOrigin('https://victim.example@' + ATTACKER + '/x', 'https://victim.example/'),
      false, 'isSameOrigin');
  });

  security('comparison', 'the same spelling under another scheme is not local either', () => {
    eq(URI.isSameOrigin('wss://victim.example@' + ATTACKER + '/x', 'wss://victim.example/'),
      false, 'isSameOrigin');
  });

  security('comparison', 'a port after the credentials does not make the target local', () => {
    eq(URI.isSameOrigin('http://victim.example@' + ATTACKER + ':8080/x', 'http://victim.example/'),
      false, 'isSameOrigin');
  });

  // -- an absolute location handed straight to the authority reader -------------------

  const absolutes = [
    ['https://////' + ATTACKER, 'over-separated https'],
    ['https:///' + ATTACKER + '/x', 'three separators'],
    ['hTTps://////' + ATTACKER, 'over-separated capitalised scheme'],
    ['ftp:////' + ATTACKER + '/x', 'over-separated ftp'],
  ];
  for (const [input, label] of absolutes) {
    security('absolute', `${label} still names its host`, () => {
      eq(URI(input).hostname(), ATTACKER, 'hostname');
    });
  }

  security('absolute', 'the documented parse entry names that host too', () => {
    eq(URI.parse('https://////' + ATTACKER).hostname, ATTACKER, 'hostname');
  });

  return cases;
};
