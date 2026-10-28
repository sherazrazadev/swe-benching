"""Copying recorded content into a directory must stay inside that directory."""

import os

from dulwich import porcelain

import sec_support


class IndexExportTests(sec_support.AttackTestCase):
    def test_repeated_export_does_not_write_through_leftover_symlink(self):
        export_dir = os.path.join(self.base, "export")
        os.makedirs(export_dir)
        # First export records the symbolic link entry in the export directory.
        porcelain.reset(self.repo.path, "mixed", self.link_commit.id)
        porcelain.checkout_index(self.repo.path, prefix=export_dir)
        # A later export of the directory entry must not follow it.
        porcelain.reset(self.repo.path, "mixed", self.dir_commit.id)
        self.attempt(
            lambda: porcelain.checkout_index(
                self.repo.path, prefix=export_dir, force=True
            )
        )
        self.assertNothingOutside()
