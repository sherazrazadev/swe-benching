// Hidden security suite. Every test drives the project's real public API (the global `Jodit`
// produced by the project's own bundle) and asserts the protected outcome: no property appears on
// the prototype shared by all objects. A thrown refusal is accepted; the side effect is what is
// checked. Nothing here imports product code to compute an expected value.
/* eslint-disable */
describe('jodit-s4 security', function () {
	function own(name) {
		return Object.prototype.hasOwnProperty(name);
	}

	function visible(name) {
		var probe = {};
		return probe[name];
	}

	function assertBlocked(name, where) {
		if (own(name) || visible(name) !== undefined) {
			throw new Error(
				'the shared prototype was changed' + (where ? ' via ' + where : '')
			);
		}
	}

	function clear(name) {
		try {
			delete Object.prototype[name];
		} catch (e) {}
	}

	function attempt(fn) {
		try {
			fn();
		} catch (e) {
			// refusing by throwing is acceptable; the side effect is asserted below
		}
	}

	afterEach(function () {
		clear('jodit_s4_t0a');
		clear('jodit_s4_t0b');
		clear('jodit_s4_t0c');
		clear('jodit_s4_t1a');
		clear('jodit_s4_t1b');
		clear('jodit_s4_t1c');
		clear('424242');
		clear('jodit_s4_t2a');
		clear('jodit_s4_t2b');
		clear('jodit_s4_t3a');
	});

	it('global configuration: a nested prototype key is ignored', function () {
		clear('jodit_s4_t0a');
		attempt(function () {
			Jodit.configure(
				JSON.parse(
					'{"controls":{"__proto__":{"jodit_s4_t0a":"yes"}}}'
				)
			);
		});
		assertBlocked('jodit_s4_t0a', 'the global configuration call');
	});

	it('global configuration: a deeply nested prototype key is ignored', function () {
		clear('jodit_s4_t0b');
		attempt(function () {
			Jodit.configure(
				JSON.parse(
					'{"controls":{"bold":{"__proto__":{"jodit_s4_t0b":"yes"}}}}'
				)
			);
		});
		assertBlocked('jodit_s4_t0b', 'a deep global configuration call');
	});

	it('the merge helper ignores a nested prototype key when called directly', function () {
		clear('jodit_s4_t0c');
		var target = { group: {} };
		attempt(function () {
			Jodit.modules.Helpers.ConfigMerge(
				target,
				JSON.parse('{"group":{"__proto__":{"jodit_s4_t0c":"yes"}}}')
			);
		});
		assertBlocked('jodit_s4_t0c', 'the merge helper');
	});

	it('a dotted write path cannot target the shared prototype', function () {
		clear('jodit_s4_t1a');
		attempt(function () {
			Jodit.modules.Helpers.set('__proto__.jodit_s4_t1a', 'yes', {});
		});
		assertBlocked('jodit_s4_t1a', 'a dotted write path');
	});

	it('a dotted write path cannot target the shared prototype through another object', function () {
		clear('jodit_s4_t1b');
		attempt(function () {
			Jodit.modules.Helpers.set(
				'holder.__proto__.jodit_s4_t1b',
				'yes',
				{}
			);
		});
		assertBlocked('jodit_s4_t1b', 'a nested dotted write path');
	});

	it('a dotted write path cannot target the shared prototype through a list segment', function () {
		clear('424242');
		attempt(function () {
			Jodit.modules.Helpers.set('__proto__.424242', 'yes', {});
		});
		if (own('424242')) {
			throw new Error('the shared prototype was changed via a list segment');
		}
	});

	it('stored settings cannot write a prototype key', function () {
		clear('jodit_s4_t2a');
		var provider = new Jodit.modules.LocalStorageProvider('jodit_s4_root_a');
		attempt(function () {
			provider.set(
				'__proto__',
				JSON.parse('{"jodit_s4_t2a":"yes"}')
			);
		});
		try {
			provider.clear();
		} catch (e) {}
		assertBlocked('jodit_s4_t2a', 'stored settings');
	});

	it('a stored partial object cannot write a prototype key', function () {
		clear('jodit_s4_t2b');
		var provider = new Jodit.modules.LocalStorageProvider('jodit_s4_root_b');
		attempt(function () {
			provider.set('group', { x: 1 });
			provider.set(
				'group',
				JSON.parse('{"__proto__":{"jodit_s4_t2b":"yes"}}')
			);
		});
		try {
			provider.clear();
		} catch (e) {}
		assertBlocked('jodit_s4_t2b', 'a stored partial object');
	});

	it('registering language packs cannot write a prototype key', function () {
		clear('jodit_s4_t3a');
		attempt(function () {
			Jodit.extendLanguages(
				JSON.parse('{"__proto__":{"jodit_s4_t3a":"yes"}}')
			);
		});
		assertBlocked('jodit_s4_t3a', 'language pack registration');
	});
});
