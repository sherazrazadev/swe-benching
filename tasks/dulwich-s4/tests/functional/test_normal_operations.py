"""Ordinary checkouts, restores and resets keep their results."""

import os

from dulwich import porcelain

import func_support


class NormalOperationTests(func_support.AttackTestCase):
    def test_checkout_selected_path_writes_inside_work_tree(self):
        porcelain.checkout(
            self.repo.path, target=self.dir_commit.id, paths=["readme"]
        )
        with open(os.path.join(self.repo.path, "readme"), "rb") as f:
            self.assertEqual(b"readme\n", f.read())

    def test_restore_nested_path_writes_inside_work_tree(self):
        self.repo.get_worktree().reset_index(
            self.dir_commit.tree, config=self.repo.get_config_stack()
        )
        os.unlink(os.path.join(self.repo.path, "evil", "payload"))
        porcelain.restore(
            self.repo.path, ["evil/payload"], source=self.dir_commit.id
        )
        with open(os.path.join(self.repo.path, "evil", "payload"), "rb") as f:
            self.assertEqual(b"payload\n", f.read())

    def test_reset_file_writes_inside_work_tree(self):
        self.repo.get_worktree().reset_index(
            self.dir_commit.tree, config=self.repo.get_config_stack()
        )
        target = os.path.join(self.repo.path, "readme")
        with open(target, "wb") as f:
            f.write(b"locally changed")
        porcelain.reset_file(self.repo, "readme", target=self.dir_commit.id)
        with open(target, "rb") as f:
            self.assertEqual(b"readme\n", f.read())

    def test_reset_index_materialises_tree_inside_work_tree(self):
        self.repo.get_worktree().reset_index(
            self.dir_commit.tree, config=self.repo.get_config_stack()
        )
        with open(os.path.join(self.repo.path, "evil", "payload"), "rb") as f:
            self.assertEqual(b"payload\n", f.read())
        with open(os.path.join(self.repo.path, "readme"), "rb") as f:
            self.assertEqual(b"readme\n", f.read())
