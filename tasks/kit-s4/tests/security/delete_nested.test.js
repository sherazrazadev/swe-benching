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

// The dangerous part sits inside an otherwise ordinary nested path, and the container it
// traverses already exists. Every part of a field path is a data key, not only the first or the
// last one.
describe('clearing a file control whose path has an inherited part inside a stored container', () => {
	const cases = [
		{
			name: 'profile.__proto__.kit_s4_nested_a',
			marker: 'kit_s4_nested_a',
			target: Object.prototype,
			seed: (instance) => instance.fields.profile.set({ label: 'stored' }),
			check: (instance) => expect(field_value(instance, 'profile', 'label')).toBe('stored')
		},
		{
			name: 'profile.constructor.prototype.kit_s4_nested_b',
			marker: 'kit_s4_nested_b',
			target: Object.prototype,
			seed: (instance) => instance.fields.profile.set({ label: 'stored' }),
			check: (instance) => expect(field_value(instance, 'profile', 'label')).toBe('stored')
		},
		{
			name: 'profile[__proto__].kit_s4_nested_c',
			marker: 'kit_s4_nested_c',
			target: Object.prototype,
			seed: (instance) => instance.fields.profile.set({ label: 'stored' }),
			check: (instance) => expect(field_value(instance, 'profile', 'label')).toBe('stored')
		},
		{
			name: 'rows[__proto__].kit_s4_nested_d',
			marker: 'kit_s4_nested_d',
			target: Array.prototype,
			seed: (instance) => instance.fields.rows.set([{ label: 'stored' }]),
			check: (instance) => expect(field_value(instance, 'rows')[0].label).toBe('stored')
		},
		{
			name: 'rows[0][__proto__].kit_s4_nested_e',
			marker: 'kit_s4_nested_e',
			target: Object.prototype,
			seed: (instance) => instance.fields.rows.set([{ label: 'stored' }]),
			check: (instance) => expect(field_value(instance, 'rows')[0].label).toBe('stored')
		}
	];

	for (const { name, marker, target, seed, check } of cases) {
		test(`refuses "${name}"`, () => {
			const { instance, element } = make_form();
			seed(instance);
			set_marker(target, marker);
			try {
				const control = add_control(element, name, { type: 'file' });
				fire(control);

				expect(marker_present(target, marker)).toBe(true);
				check(instance);
			} finally {
				clear_marker(target, marker);
			}
		});
	}
});
