// Karma configuration for the hidden suites. Runs the project's real built bundle
// (build/es2015/jodit.js, a UMD bundle exposing the global `Jodit`) in headless Chromium, so every
// test drives the same public API an application uses. The JUnit XML reporter below is the only
// output contract: it writes the file named by HTEST_OUT.
//
// Environment:
//   HTEST_FILES  colon-separated absolute paths loaded in order
//   HTEST_GREP   optional mocha grep (project suite)
//   HTEST_OUT    JUnit XML path
//   HTEST_BASE   karma basePath (defaults to /workspace)
const fs = require('fs');
const path = require('path');

const OUT = process.env.HTEST_OUT || '/tmp/results.xml';
const FILES = (process.env.HTEST_FILES || '').split(':').filter(Boolean);
const GREP = process.env.HTEST_GREP || '';

function JUnitReporter(baseReporterDecorator) {
	baseReporterDecorator(this);
	const cases = [];
	this.onSpecComplete = function (browser, result) {
		cases.push(result);
	};
	this.onRunComplete = function () {
		const esc = s =>
			String(s == null ? '' : s)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;');
		let failures = 0;
		const body = cases
			.map(r => {
				const title = (r.suite || []).concat([r.description]).join(' > ');
				const cls = (r.suite || []).join('.');
				const time = ((r.time || 0) / 1000).toFixed(3);
				if (r.success && !r.skipped) {
					return `  <testcase classname="${esc(cls)}" name="${esc(title)}" time="${time}"/>`;
				}
				if (r.skipped) {
					return `  <testcase classname="${esc(cls)}" name="${esc(title)}" time="${time}"><skipped/></testcase>`;
				}
				failures++;
				const log = (r.log || []).join('\n');
				return (
					`  <testcase classname="${esc(cls)}" name="${esc(title)}" time="${time}">` +
					`<failure message="${esc((r.log || ['failed'])[0])}">${esc(log)}</failure></testcase>`
				);
			})
			.join('\n');
		const xml =
			'<?xml version="1.0" encoding="UTF-8"?>\n' +
			`<testsuite name="jodit-s4" tests="${cases.length}" failures="${failures}" errors="0" skipped="0">\n` +
			`${body}\n</testsuite>\n`;
		fs.mkdirSync(path.dirname(OUT), { recursive: true });
		fs.writeFileSync(OUT, xml);
	};
}
JUnitReporter.$inject = ['baseReporterDecorator'];

const chromeHeadless = {
	base: 'ChromeHeadless',
	flags: [
		'--no-sandbox',
		'--disable-gpu',
		'--disable-dev-shm-usage',
		'--disable-extensions',
		'--window-size=1440,900'
	]
};

module.exports = function (config) {
	config.set({
		basePath: process.env.HTEST_BASE || '/workspace',
		frameworks: ['mocha'],
		files: FILES,
		reporters: ['progress', 'junit-custom'],
		plugins: [
			'karma-mocha',
			'karma-chrome-launcher',
			{ 'reporter:junit-custom': ['type', JUnitReporter] }
		],
		customLaunchers: { ChromeHeadlessNoSandbox: chromeHeadless },
		browsers: ['ChromeHeadlessNoSandbox'],
		singleRun: true,
		autoWatch: false,
		concurrency: 1,
		browserNoActivityTimeout: 120000,
		browserDisconnectTimeout: 30000,
		captureTimeout: 120000,
		client: {
			captureConsole: true,
			mocha: { timeout: 30000, grep: GREP }
		},
		logLevel: config.LOG_INFO
	});
};
