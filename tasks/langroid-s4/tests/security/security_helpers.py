"""Entry-point plumbing for the security suite.

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
    try:
        return ReadFileTool.create(get_curr_dir=lambda: base)(file_path=path).handle()
    except Exception:
        return ""


def write(base, path, content):
    try:
        return WriteFileTool.create(get_curr_dir=lambda: base, get_git_repo=None)(
            file_path=path, content=content, language="text"
        ).handle()
    except Exception:
        return ""


def listdir(base, path):
    try:
        return ListDirTool.create(get_curr_dir=lambda: base)(dir_path=path).handle()
    except Exception:
        return ""


def append(base, path, content):
    try:
        return AppendFileTool.create(get_curr_dir=lambda: base)(
            file_path=path, content=content
        ).handle()
    except Exception:
        return ""


def delete(base, path):
    try:
        return DeleteFileTool.create(get_curr_dir=lambda: base)(file_path=path).handle()
    except Exception:
        return ""


def move(base, src, dst):
    try:
        return MoveFileTool.create(get_curr_dir=lambda: base)(
            src_path=src, dst_path=dst
        ).handle()
    except Exception:
        return ""
