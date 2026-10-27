"""Legitimate spawn-time injection keeps working exactly as before."""
import os
import unittest

from harness.harness import Image, MetaValue, inject_data

KEY = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ test@example'


class TestSpawnInjectableLegit(unittest.TestCase):
    def setUp(self):
        self.img = Image()

    def tearDown(self):
        self.img.destroy()

    def test_ssh_key_is_appended_and_earlier_keys_survive(self):
        self.img.write('root/.ssh/authorized_keys', 'EARLIER-KEY\n')
        inject_data(self.img.root, key=KEY)
        data = self.img.read('root/.ssh/authorized_keys')
        self.assertTrue(data.startswith('EARLIER-KEY\n'),
                        'existing authorized key content was lost')
        self.assertIn('AAAAB3NzaC1yc2EAAAADAQABAAABAQ', data)

    def test_ssh_directory_is_created_when_absent(self):
        self.img.remove('root')
        inject_data(self.img.root, key=KEY)
        self.assertTrue(os.path.isfile(self.img.path('root', '.ssh',
                                                     'authorized_keys')))

    def test_network_config_is_replaced(self):
        self.img.write('etc/network/interfaces', 'OLD-NET\n')
        inject_data(self.img.root, net='NEW-NET\n')
        self.assertEqual(self.img.read('etc/network/interfaces'), 'NEW-NET\n')

    def test_metadata_is_replaced(self):
        self.img.write('meta.js', 'OLD-META')
        inject_data(self.img.root, metadata=[MetaValue('alpha', 'beta')])
        data = self.img.read('meta.js')
        self.assertIn('alpha', data)
        self.assertIn('beta', data)
        self.assertNotIn('OLD-META', data)

    def test_password_rewrite_keeps_the_other_entries(self):
        passwd = 'root:x:0:0:root:/root:/bin/sh\nuser:x:1:1::/:/bin/sh\n'
        shadow = ('root:!!:15000:0:99999:7:::\n'
                  'user:!!:15000:0:99999:7:::\n')
        self.img.write('etc/passwd', passwd)
        self.img.write('etc/shadow', shadow)
        inject_data(self.img.root, admin_password='a-new-password')
        self.assertEqual(self.img.read('etc/passwd'), passwd)
        lines = self.img.read('etc/shadow').splitlines()
        root_line = [l for l in lines if l.startswith('root:')][0]
        user_line = [l for l in lines if l.startswith('user:')][0]
        self.assertNotIn('root:!!', root_line,
                         'the root password was not updated')
        self.assertIn('user:!!:15000:0:99999:7:::', user_line,
                      'an unrelated shadow entry changed')

    def test_key_context_handling_appends_and_keeps_existing_rc_content(self):
        os.makedirs(self.img.path('etc', 'selinux'))
        self.img.write('etc/rc.local', '#!/bin/sh\nORIGINAL-LINE\n')
        inject_data(self.img.root, key=KEY)
        data = self.img.read('etc/rc.local')
        self.assertTrue(data.startswith('#!/bin/sh\nORIGINAL-LINE\n'),
                        'existing rc content was lost')
        self.assertIn('restorecon', data)


if __name__ == '__main__':
    unittest.main()
