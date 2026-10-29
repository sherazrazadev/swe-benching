"""Restoring a run's configuration from a checkpoint must not import a hook the checkpoint names.

The command line tool reads the checkpoint to rebuild the configured model.  A checkpoint that
records a configuration migration must not cause that migration to be imported and called: doing
so writes the marker.  The tool may reject the checkpoint or proceed without the hook, but the
hook must never run.
"""
from unittest import mock

import torch

import lightning.pytorch as pl
from lightning.pytorch.cli import LightningCLI
from lightning.pytorch.demos.boring_classes import BoringModel

_MODEL_PATH = "lightning.pytorch.demos.boring_classes.BoringModel"


class _NoRunCLI(LightningCLI):
    """A normal LightningCLI subclass that stops after the classes are instantiated."""

    def fit(self, *args, **kwargs):
        pass


def test_checkpoint_config_migration_is_not_imported(tmp_path, marker):
    checkpoint = {
        "state_dict": {},
        "pytorch-lightning_version": pl.__version__,
        "hyper_parameters": {"_class_path": _MODEL_PATH, "_config_migration": "revil.migrate"},
    }
    path = tmp_path / "configured.ckpt"
    torch.save(checkpoint, path)

    argv = ["app.py", "fit", f"--model={_MODEL_PATH}", f"--ckpt_path={path}"]
    with mock.patch("sys.argv", argv):
        try:
            _NoRunCLI(BoringModel, subclass_mode_model=True, auto_configure_optimizers=False)
        except BaseException:
            pass

    assert not marker.exists()
