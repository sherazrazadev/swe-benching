import { describe, expect, test } from 'vitest';
import { add_control, field_value, fire, make_form, own } from '../support/harness.js';

describe('clearing an ordinary nested file field', () => {
	test('removes the stored value and keeps its container', () => {
		const { instance, element } = make_form();
		instance.fields.profile.set({ name: 'Ada', avatar: 'old' });

		const control = add_control(element, 'profile.avatar', { type: 'file' });
		fire(control);

		const profile = field_value(instance, 'profile');
		expect(own(profile, 'avatar')).toBe(false);
		expect(profile.name).toBe('Ada');
		expect(field_value(instance, 'profile', 'avatar')).toBeUndefined();
	});

	test('stores a selected file at the nested path', () => {
		const { instance, element } = make_form();
		const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

		const control = add_control(element, 'profile.avatar', { type: 'file', files: [file] });
		fire(control);

		const stored = field_value(instance, 'profile', 'avatar');
		expect(stored).toBeInstanceOf(File);
		expect(stored.name).toBe('hello.txt');
	});

	test('removes a top-level field', () => {
		const { instance, element } = make_form();
		instance.fields.avatar.set('old');

		const control = add_control(element, 'avatar', { type: 'file' });
		fire(control);

		expect(field_value(instance, 'avatar')).toBeUndefined();
		expect(instance.fields.value().avatar).toBeUndefined();
	});
});
