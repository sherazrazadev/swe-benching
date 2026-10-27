'use strict';

/*
 * Functional cases: every legitimate shape the library already handles must keep behaving
 * exactly as it does today, including the identifiers that have no host, the ordinary web
 * locations, references resolved from a base, and the shipped browser build.
 */

const BASE = 'https://victim.example/app/';

function eq(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  }
}

module.exports = function ({ URI, bundle }) {
  const cases = [];

  function functional(className, name, run) {
    cases.push({ classname: 'functional/' + className, name, run });
  }

  // -- identifiers that are not locations --------------------------------------------

  functional('parsing', 'a mail address identifier keeps its path and has no host', () => {
    const u = URI('mailto:hello@example.org');
    eq(u.is('urn'), true, 'is urn');
    eq(u.hostname(), '', 'hostname');
    eq(u.path(), 'hello@example.org', 'path');
    eq(u.protocol(), 'mailto', 'protocol');
  });

  functional('parsing', 'an isbn identifier keeps its colon-separated path', () => {
    const u = URI('urn:isbn:0451450523');
    eq(u.is('urn'), true, 'is urn');
    eq(u.hostname(), '', 'hostname');
    eq(u.path(), 'isbn:0451450523', 'path');
  });

  functional('parsing', 'an application scheme without an authority stays an identifier', () => {
    const u = URI('custom:foo/bar');
    eq(u.is('urn'), true, 'is urn');
    eq(u.hostname(), '', 'hostname');
    eq(u.path(), 'foo/bar', 'path');
  });

  // -- ordinary web locations --------------------------------------------------------

  functional('parsing', 'an ordinary web location keeps all its components', () => {
    const u = URI('https://example.org/a/b?x=1#f');
    eq(u.hostname(), 'example.org', 'hostname');
    eq(u.path(), '/a/b', 'path');
    eq(u.query(), 'x=1', 'query');
    eq(u.fragment(), 'f', 'fragment');
    eq(u.origin(), 'https://example.org', 'origin');
    eq(u.toString(), 'https://example.org/a/b?x=1#f', 'toString');
  });

  functional('parsing', 'credentials and a port keep their values', () => {
    const u = URI('http://user:pass@example.org:8080/p');
    eq(u.hostname(), 'example.org', 'hostname');
    eq(u.username(), 'user', 'username');
    eq(u.password(), 'pass', 'password');
    eq(u.port(), '8080', 'port');
    eq(u.path(), '/p', 'path');
  });

  functional('parsing', 'an address literal keeps its host and port', () => {
    const u = URI('http://[2001:db8::1]:80/x');
    eq(u.hostname(), '2001:db8::1', 'hostname');
    eq(u.port(), '80', 'port');
    eq(u.path(), '/x', 'path');
  });

  functional('parsing', 'a protocol-relative location keeps its host', () => {
    const u = URI('//example.org/x');
    eq(u.hostname(), 'example.org', 'hostname');
    eq(u.protocol(), '', 'protocol');
    eq(u.path(), '/x', 'path');
  });

  functional('parsing', 'an empty path on a web location becomes the root', () => {
    eq(URI('https://example.org').path(), '/', 'path');
  });

  functional('parsing', 'a doubled separator inside the path is preserved', () => {
    eq(URI('https://example.org/a//b').path(), '/a//b', 'path');
  });

  functional('parsing', 'a hostless path is still relative, a web location is not', () => {
    eq(URI('/x').is('relative'), true, 'path is relative');
    eq(URI('https://example.org/x').is('relative'), false, 'web location is not relative');
  });

  // -- references resolved from a base -----------------------------------------------

  functional('reference', 'a root-relative reference stays on the base host', () => {
    eq(URI('/a/b', BASE).hostname(), 'victim.example', 'hostname');
    eq(URI('/a/b', BASE).path(), '/a/b', 'path');
  });

  functional('reference', 'a path-relative reference stays on the base host', () => {
    eq(URI('a/b', BASE).hostname(), 'victim.example', 'hostname');
    eq(URI('a/b', BASE).path(), '/app/a/b', 'path');
  });

  functional('reference', 'a query-only reference stays on the base host', () => {
    eq(URI('?q=1', BASE).hostname(), 'victim.example', 'hostname');
    eq(URI('?q=1', BASE).path(), '/app/', 'path');
  });

  functional('reference', 'a fragment-only reference stays on the base host', () => {
    eq(URI('#f', BASE).hostname(), 'victim.example', 'hostname');
    eq(URI('#f', BASE).path(), '/app/', 'path');
  });

  functional('reference', 'a protocol-relative reference takes its own host', () => {
    eq(URI('//example.org/x', BASE).hostname(), 'example.org', 'hostname');
    eq(URI('//example.org/x', BASE).path(), '/x', 'path');
  });

  // -- same-site decisions on legitimate values --------------------------------------

  functional('comparison', 'an ordinary same-host location is local', () => {
    eq(URI.isSameOrigin('https://victim.example/x', BASE), true, 'isSameOrigin');
  });

  functional('comparison', 'a path reference is local to its base', () => {
    eq(URI.isSameOrigin('/x', BASE), true, 'isSameOrigin');
  });

  functional('comparison', 'a same-host protocol-relative reference is local', () => {
    eq(URI.isSameOrigin('//victim.example/x', BASE), true, 'isSameOrigin');
  });

  functional('comparison', 'a different host is not local', () => {
    eq(URI.isSameOrigin('https://example.org/x', BASE), false, 'isSameOrigin');
  });

  functional('comparison', 'credentials that match the host still leave it local', () => {
    eq(URI.isSameOrigin('https://victim.example@victim.example/x', BASE), true, 'isSameOrigin');
  });

  // -- the shipped browser build ------------------------------------------------------

  functional('bundle', 'the shipped build parses an ordinary web location', () => {
    const u = bundle()('https://example.org/a/b?x=1#f');
    eq(u.hostname(), 'example.org', 'hostname');
    eq(u.path(), '/a/b', 'path');
    eq(u.query(), 'x=1', 'query');
    eq(u.fragment(), 'f', 'fragment');
  });

  functional('bundle', 'the shipped build keeps an identifier hostless', () => {
    const u = bundle()('mailto:hello@example.org');
    eq(u.is('urn'), true, 'is urn');
    eq(u.hostname(), '', 'hostname');
    eq(u.path(), 'hello@example.org', 'path');
  });

  functional('bundle', 'the shipped build keeps a protocol-relative host', () => {
    eq(bundle()('//example.org/x').hostname(), 'example.org', 'hostname');
  });

  functional('bundle', 'the shipped build resolves a root-relative reference locally', () => {
    eq(bundle()('/a/b', BASE).hostname(), 'victim.example', 'hostname');
    eq(bundle()('/a/b', BASE).path(), '/a/b', 'path');
  });

  return cases;
};
