"""Entry-point plumbing for the functional suite.

Only the standard library is used for temporary paths; expected values and side effects are
computed in each test, never with a product helper.
"""
from langroid.agent.tools.file_tools import (
    AppendFileTool,
    DeleteFileTool,
    ListDirTool,
    MoveFileTool,
    ReadFileTool,
    WriteFileTool,
)


def read(base, path):
    return ReadFileTool.create(get_curr_dir=lambda: base)(file_path=path).handle()


def write(base, path, content):
    return WriteFileTool.create(get_curr_dir=lambda: base, get_git_repo=None)(
        file_path=path, content=content, language="text"
    ).handle()


def write_with_repo(base, repo, path, content):
    return WriteFileTool.create(
        get_curr_dir=lambda: base, get_git_repo=lambda: repo
    )(file_path=path, content=content, language="text").handle()


def listdir(base, path):
    return ListDirTool.create(get_curr_dir=lambda: base)(dir_path=path).handle()


def append(base, path, content):
    return AppendFileTool.create(get_curr_dir=lambda: base)(
        file_path=path, content=content
    ).handle()


def delete(base, path):
    return DeleteFileTool.create(get_curr_dir=lambda: base)(file_path=path).handle()


def move(base, src, dst):
    return MoveFileTool.create(get_curr_dir=lambda: base)(
        src_path=src, dst_path=dst
    ).handle()
