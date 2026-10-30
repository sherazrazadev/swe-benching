import { describe, expect, test } from 'vitest';
import {
	add_control,
	clear_marker,
	fire,
	field_value,
	make_form,
	marker_present,
	set_marker
} from '../support/harness.js';

// A file array whose selection became empty. The same trust rule applies to the array form of a
// file control as to the single one.
describe('clearing an emptied file array named as an inherited path', () => {
	test('refuses a top-level inherited part', () => {
		const { instance, element } = make_form();
		instance.fields.keep.set('safe');
		set_marker(Object.prototype, 'kit_s4_array_a');
		try {
			const control = add_control(element, '__proto__.kit_s4_array_a[]', { type: 'file' });
			fire(control);

			expect(marker_present(Object.prototype, 'kit_s4_array_a')).toBe(true);
			expect(field_value(instance, 'keep')).toBe('safe');
		} finally {
			clear_marker(Object.prototype, 'kit_s4_array_a');
		}
	});

	test('refuses an inherited part inside a stored array path', () => {
		const { instance, element } = make_form();
		instance.fields.rows.set([{ label: 'stored' }]);
		set_marker(Array.prototype, 'kit_s4_array_b');
		try {
			const control = add_control(element, 'rows[__proto__].kit_s4_array_b[]', {
				type: 'file'
			});
			fire(control);

			expect(marker_present(Array.prototype, 'kit_s4_array_b')).toBe(true);
			expect(field_value(instance, 'rows')[0].label).toBe('stored');
		} finally {
			clear_marker(Array.prototype, 'kit_s4_array_b');
		}
	});
});
