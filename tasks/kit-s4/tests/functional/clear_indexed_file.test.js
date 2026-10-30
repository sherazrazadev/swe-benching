import { describe, expect, test } from 'vitest';
import { add_control, field_value, fire, make_form, own } from '../support/harness.js';

describe('clearing a file field addressed by an index', () => {
	test('removes only that indexed value', () => {
		const { instance, element } = make_form();
		instance.fields.rows.set([
			{ label: 'one', file: 'a' },
			{ label: 'two', file: 'b' }
		]);

		const control = add_control(element, 'rows[0].file', { type: 'file' });
		fire(control);

		const rows = field_value(instance, 'rows');
		expect(own(rows[0], 'file')).toBe(false);
		expect(rows[0].label).toBe('one');
		expect(rows[1].file).toBe('b');
		expect(rows).toHaveLength(2);
	});
});
