"""Fixtures shared by the security tests.

Each fixture builds a repository with two commits:

* the first records a symbolic link ``evil`` whose target is a directory
  outside the working tree;
* the second records a directory ``evil`` holding a regular file ``payload``.

The tests then leave the symbolic link in the working tree (or export
directory) as an earlier operation would, and drive a real public entry point
with the second tree.  The outside directory must stay empty.
"""

import os
import shutil
import tempfile
import unittest


def _commit(store, parents, tree, when):
    from dulwich.objects import Commit

    commit = Commit()
    commit.tree = tree.id
    commit.parents = parents
    commit.author = commit.committer = b"Task <task@example.com>"
    commit.author_time = commit.commit_time = when
    commit.author_timezone = commit.commit_timezone = 0
    commit.message = b"commit %d" % when
    store.add_object(commit)
    return commit


def make_repo(base):
    """Create the two-commit repository under ``base``.

    Returns ``(repo, outside_dir, symlink_commit, directory_commit)``.
    """
    from dulwich.objects import Blob, Tree
    from dulwich.repo import Repo

    path = os.path.join(base, "repo")
    os.makedirs(path)
    outside = os.path.join(base, "outside")
    os.makedirs(outside)

    repo = Repo.init(path)
    store = repo.object_store

    readme = Blob.from_string(b"readme\n")
    store.add_object(readme)

    base_tree = Tree()
    base_tree.add(b"readme", 0o100644, readme.id)
    store.add_object(base_tree)
    base_commit = _commit(store, [], base_tree, 1000)

    link_target = Blob.from_string(os.fsencode(outside))
    store.add_object(link_target)
    link_tree = Tree()
    link_tree.add(b"evil", 0o120777, link_target.id)
    link_tree.add(b"readme", 0o100644, readme.id)
    store.add_object(link_tree)
    link_commit = _commit(store, [base_commit.id], link_tree, 2000)

    payload = Blob.from_string(b"payload\n")
    store.add_object(payload)
    inner = Tree()
    inner.add(b"payload", 0o100644, payload.id)
    store.add_object(inner)
    dir_tree = Tree()
    dir_tree.add(b"evil", 0o040000, inner.id)
    dir_tree.add(b"readme", 0o100644, readme.id)
    store.add_object(dir_tree)
    dir_commit = _commit(store, [link_commit.id], dir_tree, 3000)

    repo.refs.set_if_equals(b"refs/heads/main", None, dir_commit.id)
    repo.refs.set_if_equals(b"refs/heads/link", None, link_commit.id)
    repo.refs.set_symbolic_ref(b"HEAD", b"refs/heads/main")
    return repo, outside, link_commit, dir_commit


def outside_entries(outside):
    """Everything currently present below the outside directory."""
    found = []
    for root, dirs, files in os.walk(outside):
        for name in files:
            found.append(os.path.relpath(os.path.join(root, name), outside))
        for name in dirs:
            found.append(os.path.relpath(os.path.join(root, name), outside) + "/")
    return sorted(found)


def leave_symlink(repo, outside):
    """Leave a symbolic link at ``evil`` in the working tree, as an earlier
    operation materialising the first commit would."""
    os.symlink(outside, os.path.join(repo.path, "evil"))


class AttackTestCase(unittest.TestCase):
    """Base class: a fresh two-commit repository per test."""

    def setUp(self):
        self.base = tempfile.mkdtemp(prefix="dulwich-s4-")
        self.addCleanup(shutil.rmtree, self.base, ignore_errors=True)
        self.repo, self.outside, self.link_commit, self.dir_commit = make_repo(
            self.base
        )
        self.addCleanup(self.repo.close)

    def assertNothingOutside(self):
        self.assertEqual([], outside_entries(self.outside))

    def attempt(self, fn):
        """Run an entry point; a refusal (any error) is acceptable."""
        try:
            fn()
        except Exception:
            pass


def make_benign_repo(base):
    """Create a repository whose history contains no symbolic links."""
    from dulwich.objects import Blob, Tree
    from dulwich.repo import Repo

    path = os.path.join(base, "benign")
    os.makedirs(path)
    repo = Repo.init(path)
    store = repo.object_store

    readme = Blob.from_string(b"readme\n")
    store.add_object(readme)
    tree = Tree()
    tree.add(b"readme", 0o100644, readme.id)
    store.add_object(tree)
    first = _commit(store, [], tree, 1000)

    nested = Blob.from_string(b"nested\n")
    store.add_object(nested)
    inner = Tree()
    inner.add(b"nested.txt", 0o100644, nested.id)
    store.add_object(inner)
    tree2 = Tree()
    tree2.add(b"readme", 0o100644, readme.id)
    tree2.add(b"sub", 0o040000, inner.id)
    store.add_object(tree2)
    second = _commit(store, [first.id], tree2, 2000)

    repo.refs.set_if_equals(b"refs/heads/main", None, second.id)
    repo.refs.set_symbolic_ref(b"HEAD", b"refs/heads/main")
    return repo
