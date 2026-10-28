"""The index filter still receives a real index file and its edit is kept."""

import os
import shutil
import tempfile
import unittest

from dulwich import porcelain
from dulwich.index import Index, IndexEntry
from dulwich.objects import Blob

import func_support


class IndexFilterContractTests(unittest.TestCase):
    def setUp(self):
        self.base = tempfile.mkdtemp(prefix="dulwich-s4-fb-")
        self.addCleanup(shutil.rmtree, self.base, ignore_errors=True)
        self.repo = func_support.make_benign_repo(self.base)
        self.addCleanup(self.repo.close)

    def test_index_filter_receives_writable_index_and_result_is_kept(self):
        extra = Blob.from_string(b"added by the filter\n")
        self.repo.object_store.add_object(extra)
        seen = {}

        def index_filter(tree_sha, index_path):
            seen["path"] = index_path
            seen["existed"] = os.path.isfile(index_path)
            index = Index(index_path)
            index[b"extra.txt"] = IndexEntry(
                ctime=0,
                mtime=0,
                dev=0,
                ino=0,
                mode=0o100644,
                uid=0,
                gid=0,
                size=len(b"added by the filter\n"),
                sha=extra.id,
                flags=0,
            )
            index.write()
            return None

        old_cwd = os.getcwd()
        os.chdir(self.repo.path)
        try:
            porcelain.filter_branch(
                ".",
                branch=b"main",
                index_filter=index_filter,
                force=True,
                keep_original=False,
            )
        finally:
            os.chdir(old_cwd)

        self.assertTrue(seen["existed"])
        head = self.repo.refs[b"refs/heads/main"]
        tree = self.repo[self.repo[head].tree]
        self.assertIn(b"extra.txt", tree)
        self.assertEqual(extra.id, tree[b"extra.txt"][1])
