// Test-side harness for the framework's remote-form runtime.
//
// The product code under test is read from the submitted tree (PRODUCT_ROOT, /workspace at
// grading time). The framework's real client router module is replaced by a stub because it
// pulls in the hydration/router machinery; the form runtime only uses its response caches and
// error-page hooks.
import { vi } from 'vitest';

vi.mock((process.env.PRODUCT_ROOT || '/workspace') + '/packages/kit/src/runtime/client/client.js', () => ({
	app: { hooks: { transport: {} }, decoders: {}, encoders: {} },
	query_responses: {},
	live_query_map: new Map(),
	query_map: new Map(),
	_goto: () => {},
	goto: () => {},
	set_nearest_error_page: () => {},
	invalidateAll: () => {}
}));

import { tick } from 'svelte';
import { form } from '@product/form';

export { form };

let counter = 0;

/**
 * Creates a form instance and attaches it to a fresh <form> element, the way the framework's
 * form object is spread onto a real form.
 */
export function make_form() {
	const instance = form(`kit-s4/${++counter}`);
	const element = document.createElement('form');
	const attachment = Object.getOwnPropertySymbols(instance).find(
		(symbol) => typeof instance[symbol] === 'function'
	);
	instance[attachment](element);
	return { instance, element };
}

/**
 * Appends a control to the form. A file control's selection is supplied as an array (empty for
 * "nothing selected"), which is all the runtime reads from it.
 */
export function add_control(element, name, options = {}) {
	const { type = 'text', value, checked, files = [] } = options;
	const control = document.createElement('input');
	control.type = type;
	control.name = name;
	if (value !== undefined && type !== 'file') control.value = value;
	if (checked !== undefined) control.checked = checked;
	if (type === 'file') {
		const selection = files.slice();
		selection.item = (index) => selection[index] ?? null;
		Object.defineProperty(control, 'files', { value: selection, configurable: true });
	}
	element.appendChild(control);
	return control;
}

/** Fires the ordinary DOM event the runtime listens for. */
export function fire(control, type = 'input') {
	control.dispatchEvent(new Event(type, { bubbles: true }));
}

/** Waits for the runtime's asynchronous event handlers to finish. */
export async function settle() {
	for (let i = 0; i < 3; i++) {
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** Whether `key` is an own property of `object` (never resolved through inheritance). */
export function own(object, key) {
	return Object.prototype.hasOwnProperty.call(object, key);
}

/** Installs an own marker property so a removal can be observed. */
export function set_marker(object, key, value = 'marker') {
	Object.defineProperty(object, key, { value, configurable: true, writable: true });
}

/** Whether the marker is still an own property. */
export function marker_present(object, key) {
	return own(object, key);
}

/** Removes a marker installed by a test. */
export function clear_marker(object, key) {
	delete object[key];
}

/** Reads a field through the form object's public field accessor. */
export function field_value(instance, ...path) {
	let accessor = instance.fields;
	for (const segment of path) accessor = accessor[segment];
	return accessor.value();
}
