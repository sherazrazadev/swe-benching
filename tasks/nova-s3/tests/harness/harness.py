"""Shared harness for the hidden suites.

Only the privileged mount and the run_as_root wrapper are stubbed. Every tee,
copy, touch, chmod and readlink runs for real on a temporary tree, so a fix
is judged by the writes it actually performs, wherever it places its check.
"""
import os
import shutil
import tempfile

from nova import utils
from nova.virt.disk import api as disk_api


_real_execute = utils.execute
_mounted_root = None


def _nonroot_execute(*cmd, **kwargs):
    """Run the command as the unprivileged test user.

    chown/chmod would need real root and are not the sink under test; they are
    treated as succeeding, exactly as they would for the privileged service.
    """
    kwargs.pop('run_as_root', None)
    prog = os.path.basename(str(cmd[0]))
    if prog in ('chown', 'chmod'):
        return ('', '')
    return _real_execute(*cmd, **kwargs)


class ExecuteAsUser(object):
    def __enter__(self):
        self._old = utils.execute
        utils.execute = _nonroot_execute
        return self

    def __exit__(self, *exc):
        utils.execute = self._old


class _MountedImage(object):
    """Stand-in for the privileged loop/nbd mount of the image under test."""

    def __init__(self, image=None, partition=None, use_cow=False, mount_dir=None):
        self.image = image
        self.partition = partition
        self.use_cow = use_cow
        self.mount_dir = mount_dir

    def mount(self):
        self.mount_dir = _mounted_root
        return True

    def umount(self):
        pass


class MountAs(object):
    def __init__(self, root):
        self.root = root

    def __enter__(self):
        global _mounted_root
        self._old_cls = disk_api._DiskImage
        self._old_root = _mounted_root
        _mounted_root = self.root
        disk_api._DiskImage = _MountedImage
        return self

    def __exit__(self, *exc):
        global _mounted_root
        disk_api._DiskImage = self._old_cls
        _mounted_root = self._old_root


def inject_files(root, files):
    """Drive the public personality-file injection entry point."""
    with MountAs(root), ExecuteAsUser():
        disk_api.inject_files('disk.img', files)


def inject_data(root, key=None, net=None, metadata=None, admin_password=None):
    """Drive the public spawn-time injection entry point."""
    with MountAs(root), ExecuteAsUser():
        disk_api.inject_data('disk.img', key=key, net=net, metadata=metadata,
                             admin_password=admin_password)


class MetaValue(object):
    """The attribute shape the injection code expects for one metadata entry."""

    def __init__(self, key, value):
        self.key = key
        self.value = value


class Image(object):
    """A temporary image root plus a sibling directory that must stay untouched."""

    def __init__(self):
        self.base = tempfile.mkdtemp(prefix='nova-s3-')
        self.root = os.path.join(self.base, 'image')
        self.outside = os.path.join(self.base, 'outside')
        for p in (self.root, self.outside,
                  os.path.join(self.root, 'etc'),
                  os.path.join(self.root, 'root', '.ssh')):
            os.makedirs(p)

    def path(self, *parts):
        return os.path.join(self.root, *parts)

    def outside_path(self, *parts):
        return os.path.join(self.outside, *parts)

    def write(self, rel, data):
        p = self.path(*rel.split('/'))
        parent = os.path.dirname(p)
        if not os.path.isdir(parent):
            os.makedirs(parent)
        f = open(p, 'w')
        try:
            f.write(data)
        finally:
            f.close()
        return p

    def read(self, rel):
        f = open(self.path(*rel.split('/')))
        try:
            return f.read()
        finally:
            f.close()

    def remove(self, rel):
        p = self.path(*rel.split('/'))
        if os.path.islink(p) or os.path.isfile(p):
            os.unlink(p)
        elif os.path.isdir(p):
            shutil.rmtree(p)

    def symlink(self, target, rel):
        os.symlink(target, self.path(*rel.split('/')))

    def destroy(self):
        shutil.rmtree(self.base, ignore_errors=True)
