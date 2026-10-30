import { describe, expect, test } from 'vitest';
import { add_control, field_value, make_form, own, settle } from '../support/harness.js';

describe('rebuilding the stored values from the form', () => {
	test('takes current control values and drops what the form no longer has', async () => {
		const { instance, element } = make_form();
		add_control(element, 'name', { value: 'safe' });
		add_control(element, 'avatar', { type: 'file' });
		instance.fields.extra.set('stale');

		element.dispatchEvent(new Event('reset'));
		await settle();

		expect(field_value(instance, 'name')).toBe('safe');
		expect(field_value(instance, 'extra')).toBeUndefined();
		const state = instance.fields.value();
		expect(own(state, 'avatar')).toBe(false);
		expect(own(state, 'name')).toBe(true);
	});

	test('rebuilds nested names from the form controls', async () => {
		const { instance, element } = make_form();
		add_control(element, 'profile.name', { value: 'Ada' });
		add_control(element, 'profile.role', { value: 'engineer' });

		element.dispatchEvent(new Event('reset'));
		await settle();

		expect(field_value(instance, 'profile', 'name')).toBe('Ada');
		expect(field_value(instance, 'profile', 'role')).toBe('engineer');
	});
});
