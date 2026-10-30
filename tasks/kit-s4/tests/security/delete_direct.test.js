import { describe, expect, test } from 'vitest';
import {
	add_control,
	clear_marker,
	fire,
	field_value,
	make_form,
	marker_present,
	own,
	set_marker
} from '../support/harness.js';

// An emptied file control whose name is a nested path. A path part that every object inherits
// must never be used to reach a shared object.
describe('clearing an emptied file control named as an inherited path', () => {
	const cases = [
		{ name: '__proto__.kit_s4_direct_a', marker: 'kit_s4_direct_a' },
		{ name: 'constructor.prototype.kit_s4_direct_b', marker: 'kit_s4_direct_b' }
	];

	for (const { name, marker } of cases) {
		test(`refuses "${name}"`, () => {
			const { instance, element } = make_form();
			instance.fields.keep.set('safe');
			set_marker(Object.prototype, marker);
			try {
				const control = add_control(element, name, { type: 'file' });
				fire(control);

				expect(marker_present(Object.prototype, marker)).toBe(true);
				expect(own(instance.fields.value(), marker)).toBe(false);
				expect(field_value(instance, 'keep')).toBe('safe');
			} finally {
				clear_marker(Object.prototype, marker);
			}
		});
	}
});
