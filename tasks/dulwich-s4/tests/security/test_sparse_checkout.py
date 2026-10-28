"""Sparse checkout must not write outside the working tree."""

from dulwich import porcelain

import sec_support


class SparseCheckoutWriteTests(sec_support.AttackTestCase):
    def test_sparse_checkout_does_not_write_through_symlink(self):
        sec_support.leave_symlink(self.repo, self.outside)
        porcelain.reset(self.repo.path, "mixed", self.dir_commit.id)
        self.attempt(
            lambda: porcelain.sparse_checkout(
                self.repo.path, patterns=["*"], force=True, cone=False
            )
        )
        self.assertNothingOutside()
