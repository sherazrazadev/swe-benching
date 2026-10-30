import { describe, expect, test } from 'vitest';
import { add_control, field_value, fire, make_form } from '../support/harness.js';

describe('ordinary field binding through the form', () => {
	test('plain, dotted and indexed text controls bind', () => {
		const { instance, element } = make_form();

		fire(add_control(element, 'name', { value: 'Ada' }));
		fire(add_control(element, 'user.name', { value: 'Grace' }));
		fire(add_control(element, 'items[0].label', { value: 'first' }));

		expect(field_value(instance, 'name')).toBe('Ada');
		expect(field_value(instance, 'user', 'name')).toBe('Grace');
		expect(field_value(instance, 'items')[0].label).toBe('first');
	});

	test('checkbox and number controls keep their types', () => {
		const { instance, element } = make_form();

		const agree = add_control(element, 'b:agree', { type: 'checkbox', checked: true });
		fire(agree);
		expect(field_value(instance, 'agree')).toBe(true);

		agree.checked = false;
		fire(agree);
		expect(field_value(instance, 'agree')).toBe(false);

		fire(add_control(element, 'n:count', { type: 'number', value: '7' }));
		expect(field_value(instance, 'count')).toBe(7);
	});

	test('a change to one field preserves the others', () => {
		const { instance, element } = make_form();
		instance.fields.first.set('kept');

		fire(add_control(element, 'second', { value: 'changed' }));

		expect(field_value(instance, 'first')).toBe('kept');
		expect(field_value(instance, 'second')).toBe('changed');
	});
});
