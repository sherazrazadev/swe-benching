"""History rewriting must not write outside the working directory."""

import os

from dulwich import porcelain

import sec_support


class IndexFilterWorkingDirectoryTests(sec_support.AttackTestCase):
    def test_index_filter_does_not_write_outside_working_directory(self):
        old_cwd = os.getcwd()
        os.chdir(self.repo.path)
        try:
            self.attempt(
                lambda: porcelain.filter_branch(
                    ".",
                    branch=b"main",
                    index_filter=lambda tree_sha, index_path: None,
                    force=True,
                    keep_original=False,
                )
            )
        finally:
            os.chdir(old_cwd)
        self.assertNothingOutside()
