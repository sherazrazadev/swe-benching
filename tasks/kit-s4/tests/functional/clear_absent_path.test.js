import { describe, expect, test } from 'vitest';
import { add_control, field_value, fire, make_form, own } from '../support/harness.js';

describe('clearing a file field whose containing path was never stored', () => {
	test('changes nothing and creates no containers', () => {
		const { instance, element } = make_form();
		instance.fields.keep.set('safe');

		const control = add_control(element, 'ghost.deep.avatar', { type: 'file' });
		fire(control);

		expect(field_value(instance, 'ghost')).toBeUndefined();
		expect(field_value(instance, 'ghost', 'deep')).toBeUndefined();
		const state = instance.fields.value();
		expect(own(state, 'ghost')).toBe(false);
		expect(state.keep).toBe('safe');
	});
});
