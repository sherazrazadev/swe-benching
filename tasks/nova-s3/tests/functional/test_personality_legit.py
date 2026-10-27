"""Legitimate personality-file injection keeps working exactly as before."""
import os
import unittest

from harness.harness import Image, inject_files


class TestPersonalityFileLegit(unittest.TestCase):
    def setUp(self):
        self.img = Image()

    def tearDown(self):
        self.img.destroy()

    def test_absolute_path_is_written_inside(self):
        inject_files(self.img.root, [('/etc/motd', 'HELLO')])
        self.assertEqual(self.img.read('etc/motd'), 'HELLO')

    def test_parent_segments_resolving_inside(self):
        inject_files(self.img.root, [('etc/../etc/hostname', 'HOST')])
        self.assertEqual(self.img.read('etc/hostname'), 'HOST')

    def test_deep_new_directory_is_created(self):
        inject_files(self.img.root, [('var/lib/cloud/instance/config', 'DEEP')])
        self.assertEqual(self.img.read('var/lib/cloud/instance/config'), 'DEEP')

    def test_several_files_in_one_request(self):
        inject_files(self.img.root, [('etc/a', 'A'), ('etc/b', 'B'),
                                     ('srv/c', 'C')])
        self.assertEqual(self.img.read('etc/a'), 'A')
        self.assertEqual(self.img.read('etc/b'), 'B')
        self.assertEqual(self.img.read('srv/c'), 'C')

    def test_existing_file_is_replaced_not_appended(self):
        self.img.write('etc/motd', 'OLD')
        inject_files(self.img.root, [('etc/motd', 'NEW')])
        self.assertEqual(self.img.read('etc/motd'), 'NEW')

    def test_entry_resolving_inside_is_still_writable(self):
        self.img.write('var/motd', 'OLD')
        self.img.symlink('../var/motd', 'etc/motd')
        inject_files(self.img.root, [('etc/motd', 'NEW')])
        self.assertEqual(self.img.read('var/motd'), 'NEW')


if __name__ == '__main__':
    unittest.main()
