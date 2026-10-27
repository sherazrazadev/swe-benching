"""Personality-file injection must not touch anything outside the image root."""
import os
import unittest

from harness.harness import Image, inject_files

PAYLOAD = 'INJECTED-PAYLOAD'


class TestPersonalityFileEscape(unittest.TestCase):
    def setUp(self):
        self.img = Image()

    def tearDown(self):
        self.img.destroy()

    def _refused_and_absent(self, target, files):
        with self.assertRaises(Exception):
            inject_files(self.img.root, files)
        self.assertFalse(os.path.exists(target),
                         'a file was created outside the image root')

    def test_parent_directory_traversal(self):
        target = self.img.outside_path('pwned')
        self._refused_and_absent(target, [('../outside/pwned', PAYLOAD)])

    def test_target_sharing_the_image_root_name(self):
        # The escaped target lives in a sibling whose name starts with the
        # image root's name, so a string-prefix comparison alone is wrong.
        sibling = os.path.join(self.img.base, 'imageX')
        os.makedirs(sibling)
        target = os.path.join(sibling, 'pwned')
        self._refused_and_absent(target, [('../imageX/pwned', PAYLOAD)])

    def test_symlinked_directory_in_image(self):
        self.img.remove('etc')
        os.makedirs(self.img.outside_path('etcdir'))
        self.img.symlink(self.img.outside_path('etcdir'), 'etc')
        target = self.img.outside_path('etcdir', 'interfaces')
        self._refused_and_absent(target, [('etc/interfaces', PAYLOAD)])

    def test_symlinked_target_file_in_image(self):
        self.img.symlink(self.img.outside_path('motd'), 'motd')
        target = self.img.outside_path('motd')
        self._refused_and_absent(target, [('motd', PAYLOAD)])


if __name__ == '__main__':
    unittest.main()
