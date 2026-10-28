"""Whole-tree materialisation must keep writes inside the working tree."""

from dulwich import porcelain

import sec_support


class FullTreeMaterialisationTests(sec_support.AttackTestCase):
    def test_reset_index_does_not_write_through_symlink(self):
        sec_support.leave_symlink(self.repo, self.outside)
        self.attempt(
            lambda: self.repo.get_worktree().reset_index(
                self.dir_commit.tree, config=self.repo.get_config_stack()
            )
        )
        self.assertNothingOutside()

    def test_cone_mode_disable_does_not_write_through_symlink(self):
        sec_support.leave_symlink(self.repo, self.outside)
        porcelain.reset(self.repo.path, "mixed", self.dir_commit.id)
        self.attempt(
            lambda: porcelain.cone_mode_disable(self.repo.path, force=True)
        )
        self.assertNothingOutside()
