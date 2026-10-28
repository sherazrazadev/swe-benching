"""Sparse checkout and cone mode keep working on ordinary trees."""

import os

from dulwich import porcelain

import func_support


class SparseBehaviourTests(func_support.AttackTestCase):
    def test_sparse_checkout_excludes_and_restores_files(self):
        self.repo.get_worktree().reset_index(
            self.dir_commit.tree, config=self.repo.get_config_stack()
        )
        porcelain.sparse_checkout(
            self.repo.path, patterns=["readme"], force=True, cone=False
        )
        self.assertFalse(
            os.path.exists(os.path.join(self.repo.path, "evil", "payload"))
        )
        porcelain.sparse_checkout(
            self.repo.path, patterns=["*"], force=True, cone=False
        )
        with open(os.path.join(self.repo.path, "evil", "payload"), "rb") as f:
            self.assertEqual(b"payload\n", f.read())

    def test_cone_mode_disable_restores_the_tree(self):
        self.repo.get_worktree().reset_index(
            self.dir_commit.tree, config=self.repo.get_config_stack()
        )
        porcelain.reset(self.repo.path, "mixed", self.dir_commit.id)
        porcelain.sparse_checkout(
            self.repo.path, patterns=["readme"], force=True, cone=False
        )
        porcelain.cone_mode_disable(self.repo.path, force=True)
        with open(os.path.join(self.repo.path, "evil", "payload"), "rb") as f:
            self.assertEqual(b"payload\n", f.read())
