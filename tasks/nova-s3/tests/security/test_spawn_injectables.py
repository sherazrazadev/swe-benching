"""Spawn-time injection must not touch anything outside the image root either."""
import os
import unittest

from harness.harness import Image, MetaValue, inject_data

KEY = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ test@example'
SHADOW = 'root:!!:15000:0:99999:7:::\n'


class TestSpawnInjectableEscape(unittest.TestCase):
    def setUp(self):
        self.img = Image()

    def tearDown(self):
        self.img.destroy()

    def test_ssh_key_through_symlinked_ssh_directory(self):
        self.img.remove('root/.ssh')
        os.makedirs(self.img.outside_path('sshdir'))
        self.img.symlink(self.img.outside_path('sshdir'), 'root/.ssh')
        target = self.img.outside_path('sshdir', 'authorized_keys')
        with self.assertRaises(Exception):
            inject_data(self.img.root, key=KEY)
        self.assertFalse(os.path.exists(target),
                         'the ssh directory escape was not blocked')

    def test_network_config_through_symlinked_network_directory(self):
        os.makedirs(self.img.outside_path('netdir'))
        self.img.symlink(self.img.outside_path('netdir'), 'etc/network')
        target = self.img.outside_path('netdir', 'interfaces')
        with self.assertRaises(Exception):
            inject_data(self.img.root, net='auto lo\n')
        self.assertFalse(os.path.exists(target),
                         'the network directory escape was not blocked')

    def test_metadata_through_symlinked_metadata_file(self):
        self.img.symlink(self.img.outside_path('meta.js'), 'meta.js')
        target = self.img.outside_path('meta.js')
        with self.assertRaises(Exception):
            inject_data(self.img.root, metadata=[MetaValue('k', 'v')])
        self.assertFalse(os.path.exists(target),
                         'the metadata file escape was not blocked')

    def test_password_through_symlinked_shadow_file(self):
        self.img.write('etc/passwd', 'root:x:0:0:root:/root:/bin/sh\n')
        outside_shadow = self.img.outside_path('shadow')
        f = open(outside_shadow, 'w')
        f.write(SHADOW)
        f.close()
        self.img.symlink(outside_shadow, 'etc/shadow')
        with self.assertRaises(Exception):
            inject_data(self.img.root, admin_password='a-new-password')
        f = open(outside_shadow)
        try:
            after = f.read()
        finally:
            f.close()
        self.assertEqual(after, SHADOW,
                         'the outside shadow file was rewritten')

    def test_key_context_file_through_symlinked_rc_local(self):
        os.makedirs(self.img.path('etc', 'selinux'))
        self.img.symlink(self.img.outside_path('rc.local'), 'etc/rc.local')
        target = self.img.outside_path('rc.local')
        with self.assertRaises(Exception):
            inject_data(self.img.root, key=KEY)
        self.assertFalse(os.path.exists(target),
                         'the key-context write escaped the image')

    def test_key_context_file_through_symlinked_rc_directory(self):
        os.makedirs(self.img.path('etc', 'selinux'))
        os.makedirs(self.img.outside_path('rcdir'))
        self.img.symlink(self.img.outside_path('rcdir'), 'etc/rc.d')
        target = self.img.outside_path('rcdir', 'rc.local')
        with self.assertRaises(Exception):
            inject_data(self.img.root, key=KEY)
        self.assertFalse(os.path.exists(target),
                         'the key-context write escaped through the rc directory')

    def test_password_lock_file_through_symlink(self):
        self.img.write('etc/passwd', 'root:x:0:0:root:/root:/bin/sh\n')
        self.img.write('etc/shadow', SHADOW)
        self.img.symlink(self.img.outside_path('lock'), 'etc/.pwd.lock')
        target = self.img.outside_path('lock')
        with self.assertRaises(Exception):
            inject_data(self.img.root, admin_password='a-new-password')
        self.assertFalse(os.path.exists(target),
                         'the password lock created a file outside the image')


if __name__ == '__main__':
    unittest.main()
