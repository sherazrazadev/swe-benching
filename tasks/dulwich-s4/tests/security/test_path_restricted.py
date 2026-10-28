"""Writing selected paths into the working tree must stay inside it."""

from dulwich import porcelain

import sec_support


class PathRestrictedWriteTests(sec_support.AttackTestCase):
    def _leave_symlink(self):
        sec_support.leave_symlink(self.repo, self.outside)

    def test_checkout_selected_paths_does_not_write_through_symlink(self):
        self._leave_symlink()
        self.attempt(
            lambda: porcelain.checkout(
                self.repo.path, target=self.dir_commit.id, paths=["evil/payload"]
            )
        )
        self.assertNothingOutside()

    def test_restore_from_source_does_not_write_through_symlink(self):
        self._leave_symlink()
        self.attempt(
            lambda: porcelain.restore(
                self.repo.path, ["evil/payload"], source=self.dir_commit.id
            )
        )
        self.assertNothingOutside()

    def test_restore_from_index_does_not_write_through_symlink(self):
        self._leave_symlink()
        porcelain.reset(self.repo.path, "mixed", self.dir_commit.id)
        self.attempt(
            lambda: porcelain.restore(self.repo.path, ["evil/payload"])
        )
        self.assertNothingOutside()

    def test_reset_file_does_not_write_through_symlink(self):
        self._leave_symlink()
        self.attempt(
            lambda: porcelain.reset_file(
                self.repo, "evil/payload", target=self.dir_commit.id
            )
        )
        self.assertNothingOutside()
