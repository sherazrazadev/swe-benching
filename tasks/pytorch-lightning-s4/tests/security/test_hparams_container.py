"""A checkpoint-recorded hyperparameter container name must not be imported.

Older checkpoints may name the container that holds the hyperparameters.  A plain legacy name is
data; a dotted name selects a callable that the loader would import and call before the model is
built.  The call must be refused with no marker written.
"""
import pytest
import torch

import lightning.pytorch as pl
from lightning.pytorch.demos.boring_classes import BoringModel


def test_dotted_hparams_container_is_not_imported(tmp_path, marker):
    checkpoint = {
        "state_dict": {},
        "pytorch-lightning_version": pl.__version__,
        "hyper_parameters": {},
        "hparams_type": "revil.convert",
    }
    path = tmp_path / "container.ckpt"
    torch.save(checkpoint, path)

    with pytest.raises(Exception):
        BoringModel.load_from_checkpoint(path, strict=False)
    assert not marker.exists()
