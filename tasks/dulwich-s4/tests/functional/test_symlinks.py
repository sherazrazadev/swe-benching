"""Legitimate symbolic links keep working as they do today."""

import os

from dulwich import porcelain
from dulwich.objects import Blob, Tree

import func_support


class SymlinkBehaviourTests(func_support.AttackTestCase):
    def test_tree_symlink_entry_is_materialised_as_symlink(self):
        self.repo.get_worktree().reset_index(
            self.link_commit.tree, config=self.repo.get_config_stack()
        )
        link = os.path.join(self.repo.path, "evil")
        self.assertTrue(os.path.islink(link))
        self.assertEqual(
            os.fsencode(self.outside), os.fsencode(os.readlink(link))
        )

    def test_regular_file_placed_over_symlink_replaces_it(self):
        secret = os.path.join(self.outside, "secret")
        with open(secret, "wb") as f:
            f.write(b"untouched")

        target = os.path.join(self.repo.path, "evil")
        os.symlink(secret, target)

        blob = Blob.from_string(b"tracked content\n")
        self.repo.object_store.add_object(blob)
        tree = Tree()
        tree.add(b"evil", 0o100644, blob.id)
        self.repo.object_store.add_object(tree)

        porcelain.checkout(
            self.repo.path, target=tree.id, paths=["evil"]
        )

        self.assertFalse(os.path.islink(target))
        with open(target, "rb") as f:
            self.assertEqual(b"tracked content\n", f.read())
        with open(secret, "rb") as f:
            self.assertEqual(b"untouched", f.read())
