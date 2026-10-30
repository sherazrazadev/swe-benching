import { describe, expect, test } from 'vitest';
import { add_control, field_value, fire, make_form, own } from '../support/harness.js';

describe('file arrays', () => {
	test('an emptied file array removes the stored selection', () => {
		const { instance, element } = make_form();
		instance.fields.photos.set(['old']);

		const control = add_control(element, 'photos[]', { type: 'file' });
		fire(control);

		expect(field_value(instance, 'photos')).toBeUndefined();
		expect(own(instance.fields.value(), 'photos')).toBe(false);
	});

	test('an emptied nested file array leaves its container intact', () => {
		const { instance, element } = make_form();
		instance.fields.albums.set([{ title: 'holiday', photos: ['old'] }]);

		const control = add_control(element, 'albums[0].photos[]', { type: 'file' });
		fire(control);

		const albums = field_value(instance, 'albums');
		expect(own(albums[0], 'photos')).toBe(false);
		expect(albums[0].title).toBe('holiday');
	});

	test('a selected file array is stored', () => {
		const { instance, element } = make_form();
		const file = new File(['x'], 'x.txt', { type: 'text/plain' });

		const control = add_control(element, 'photos[]', { type: 'file', files: [file] });
		fire(control);

		const photos = field_value(instance, 'photos');
		expect(Array.isArray(photos)).toBe(true);
		expect(photos).toHaveLength(1);
		expect(photos[0].name).toBe('x.txt');
	});
});
