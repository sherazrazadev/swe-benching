// Hidden functional suite: legitimate configuration behaviour that the fix must not change.
// Drives the same public API as the security suite and uses no product helper to compute values.
/* eslint-disable */
describe('jodit-s4 functional', function () {
	function assert(cond, message) {
		if (!cond) {
			throw new Error(message);
		}
	}

	function cleanupControl(name) {
		try {
			delete Jodit.defaultOptions.controls[name];
		} catch (e) {}
	}

	it('a partial global configuration merges and keeps sibling controls', function () {
		var before = Jodit.defaultOptions.controls.bold;
		try {
			Jodit.configure({
				controls: {
					jodit_s4_func_btn: {
						icon: 'pencil',
						command: 'selectall'
					}
				}
			});
			var added = Jodit.defaultOptions.controls.jodit_s4_func_btn;
			assert(added && added.icon === 'pencil', 'new control not merged');
			assert(
				added.command === 'selectall',
				'new control command not merged'
			);
			assert(
				Jodit.defaultOptions.controls.bold === before,
				'existing control was replaced'
			);
		} finally {
			cleanupControl('jodit_s4_func_btn');
		}
	});

	it('values marked atomic replace instead of merging', function () {
		var original = Jodit.defaultOptions.controls.fontsize;
		var originalList = original && original.list;
		try {
			Jodit.configure({
				controls: {
					fontsize: {
						list: Jodit.atom([8, 9, 10])
					}
				}
			});
			var list = Jodit.defaultOptions.controls.fontsize.list;
			assert(
				list.length === 3 &&
					list[0] === 8 &&
					list[1] === 9 &&
					list[2] === 10,
				'atomic list did not replace the stored one'
			);
			assert(
				Jodit.defaultOptions.controls.fontsize.icon ===
					original.icon,
				'atomic replacement dropped a sibling field'
			);
		} finally {
			if (original) {
				original.list = originalList;
			}
			Jodit.defaultOptions.controls.fontsize = original;
		}
	});

	it('dotted writes still create nested objects and lists', function () {
		var tree = {};
		Jodit.modules.Helpers.set('a.b.c', 1, tree);
		assert(
			tree.a && tree.a.b && tree.a.b.c === 1,
			'dotted write did not create the path'
		);

		var list = {};
		Jodit.modules.Helpers.set('list.0.name', 'first', list);
		assert(
			Array.isArray(list.list) &&
				list.list[0] &&
				list.list[0].name === 'first',
			'numeric segment did not create a list'
		);
	});

	it('a dotted write into an existing object keeps its sibling fields', function () {
		var tree = { a: { b: { c: 1, d: 2 } } };
		Jodit.modules.Helpers.set('a.b.e', 3, tree);
		assert(tree.a.b.c === 1, 'existing field was dropped');
		assert(tree.a.b.d === 2, 'existing field was dropped');
		assert(tree.a.b.e === 3, 'new field was not written');
	});

	it('empty and non-string write chains are ignored', function () {
		var tree = { a: 1 };
		Jodit.modules.Helpers.set('', 2, tree);
		Jodit.modules.Helpers.set(null, 3, tree);
		Jodit.modules.Helpers.set(undefined, 4, tree);
		assert(tree.a === 1, 'a no-op write changed the object');
		assert(
			Object.keys(tree).length === 1,
			'a no-op write added a property to the object'
		);
	});

	it('stored settings keep earlier fields when a partial object is stored', function () {
		var provider = new Jodit.modules.LocalStorageProvider(
			'jodit_s4_func_root'
		);
		try {
			provider.set('profile', { name: 'sam', role: 'editor' });
			provider.set('profile', { role: 'owner' });
			var stored = provider.get('profile');
			assert(stored && stored.name === 'sam', 'earlier field was lost');
			assert(stored.role === 'owner', 'updated field was not stored');

			provider.set('mode', 'full');
			provider.set('mode', 'compact');
			assert(provider.get('mode') === 'compact', 'plain value not stored');
		} finally {
			try {
				provider.clear();
			} catch (e) {}
		}
	});

	it('language packs are added and extended', function () {
		try {
			Jodit.extendLanguages({ jodit_s4_lang: { Hello: 'Hi' } });
			assert(
				Jodit.lang.jodit_s4_lang &&
					Jodit.lang.jodit_s4_lang.Hello === 'Hi',
				'a new pack was not registered'
			);
			Jodit.extendLanguages({ jodit_s4_lang: { Bye: 'Bye' } });
			assert(
				Jodit.lang.jodit_s4_lang.Hello === 'Hi' &&
					Jodit.lang.jodit_s4_lang.Bye === 'Bye',
				'an existing pack was not extended'
			);
		} finally {
			try {
				delete Jodit.lang.jodit_s4_lang;
			} catch (e) {}
		}
	});

	it('per-editor options still inherit defaults through the prototype chain', function () {
		var element = document.createElement('div');
		document.body.appendChild(element);
		var editor = null;
		try {
			Jodit.configure({
				controls: {
					jodit_s4_func_merge: {
						icon: 'pencil',
						command: 'selectall',
						tooltip: 'Global tooltip'
					}
				}
			});

			editor = Jodit.make(element, {
				controls: {
					jodit_s4_func_merge: {
						icon: 'bold'
					}
				}
			});

			var merged = editor.o.controls.jodit_s4_func_merge;
			assert(merged.icon === 'bold', 'per-editor value was not applied');
			assert(
				merged.command === 'selectall',
				'the configured default did not show through'
			);
			assert(
				merged.tooltip === 'Global tooltip',
				'the configured default did not show through'
			);
		} finally {
			try {
				if (editor) {
					editor.destruct();
				}
			} catch (e) {}
			cleanupControl('jodit_s4_func_merge');
			try {
				document.body.removeChild(element);
			} catch (e) {}
		}
	});
});
