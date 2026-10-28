"""Copying recorded content into a directory keeps working."""

import os

from dulwich import porcelain

import func_support


class IndexExportBehaviourTests(func_support.AttackTestCase):
    def test_export_writes_files_and_symlinks(self):
        export_dir = os.path.join(self.base, "export")
        os.makedirs(export_dir)
        porcelain.reset(self.repo.path, "mixed", self.dir_commit.id)
        porcelain.checkout_index(self.repo.path, prefix=export_dir)
        with open(os.path.join(export_dir, "evil", "payload"), "rb") as f:
            self.assertEqual(b"payload\n", f.read())
        with open(os.path.join(export_dir, "readme"), "rb") as f:
            self.assertEqual(b"readme\n", f.read())

        link_dir = os.path.join(self.base, "link-export")
        os.makedirs(link_dir)
        porcelain.reset(self.repo.path, "mixed", self.link_commit.id)
        porcelain.checkout_index(self.repo.path, prefix=link_dir)
        link = os.path.join(link_dir, "evil")
        self.assertTrue(os.path.islink(link))
        self.assertEqual(os.fsencode(self.outside), os.fsencode(os.readlink(link)))

    def test_export_can_select_paths(self):
        export_dir = os.path.join(self.base, "selected")
        os.makedirs(export_dir)
        porcelain.reset(self.repo.path, "mixed", self.dir_commit.id)
        porcelain.checkout_index(
            self.repo.path, prefix=export_dir, paths=["readme"]
        )
        self.assertTrue(os.path.isfile(os.path.join(export_dir, "readme")))
        self.assertFalse(os.path.exists(os.path.join(export_dir, "evil")))
