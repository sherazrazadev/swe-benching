import { describe, expect, test } from 'vitest';
import {
	add_control,
	clear_marker,
	make_form,
	marker_present,
	set_marker,
	settle
} from '../support/harness.js';

// A form reset rebuilds the stored values from the form's own controls. An emptied file control
// contributes no value, and its name must be treated exactly like any other field name.
describe('rebuilding stored values from a form with an emptied file control', () => {
	test('refuses an inherited path part', async () => {
		const { element } = make_form();
		add_control(element, 'keep', { value: 'safe' });
		add_control(element, '__proto__.kit_s4_reset_a', { type: 'file' });
		set_marker(Object.prototype, 'kit_s4_reset_a');
		try {
			element.dispatchEvent(new Event('reset'));
			await settle();

			expect(marker_present(Object.prototype, 'kit_s4_reset_a')).toBe(true);
		} finally {
			clear_marker(Object.prototype, 'kit_s4_reset_a');
		}
	});

	test('refuses an inherited part after ordinary nested values', async () => {
		const { element } = make_form();
		add_control(element, 'rows[0].label', { value: 'stored' });
		add_control(element, 'rows[__proto__].kit_s4_reset_b', { type: 'file' });
		set_marker(Array.prototype, 'kit_s4_reset_b');
		try {
			element.dispatchEvent(new Event('reset'));
			await settle();

			expect(marker_present(Array.prototype, 'kit_s4_reset_b')).toBe(true);
		} finally {
			clear_marker(Array.prototype, 'kit_s4_reset_b');
		}
	});

	test('refuses an inherited constructor path', async () => {
		const { element } = make_form();
		add_control(element, 'keep', { value: 'safe' });
		add_control(element, 'constructor.prototype.kit_s4_reset_c', { type: 'file' });
		set_marker(Object.prototype, 'kit_s4_reset_c');
		try {
			element.dispatchEvent(new Event('reset'));
			await settle();

			expect(marker_present(Object.prototype, 'kit_s4_reset_c')).toBe(true);
		} finally {
			clear_marker(Object.prototype, 'kit_s4_reset_c');
		}
	});
});
