import { describe, expect, test } from 'vitest';
import { add_control, field_value, fire, make_form, own } from '../support/harness.js';

describe('values that are legitimately undefined', () => {
	test('assigning undefined keeps the field stored', () => {
		const { instance } = make_form();
		instance.fields.profile.set({ avatar: 'set' });
		instance.fields.profile.avatar.set(undefined);

		const profile = field_value(instance, 'profile');
		expect(own(profile, 'avatar')).toBe(true);
		expect(profile.avatar).toBeUndefined();
	});

	test('an emptied number control is stored as undefined', () => {
		const { instance, element } = make_form();

		const control = add_control(element, 'n:count', { type: 'number', value: '42' });
		fire(control);
		expect(field_value(instance, 'count')).toBe(42);

		control.value = '';
		fire(control);
		expect(field_value(instance, 'count')).toBeUndefined();
		expect(own(instance.fields.value(), 'count')).toBe(true);
	});
});
