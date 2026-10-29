"""A checkpoint must not be able to select a function that builds the object.

The routes below all carry the same value into the same construction arguments: the current
settings key, the two legacy keys, and the datamodule's own settings key.  A call that runs the
named function writes the marker; a call that refuses is an ordinary error with no marker.
"""
import pytest
import torch

import lightning.pytorch as pl
from lightning.pytorch.demos.boring_classes import BoringDataModule, BoringModel


def _checkpoint(tmp_path, payload, name="evil.ckpt"):
    checkpoint = {"state_dict": {}, "pytorch-lightning_version": pl.__version__}
    checkpoint.update(payload)
    path = tmp_path / name
    torch.save(checkpoint, path)
    return path


def test_instantiator_in_the_current_settings_key(tmp_path, marker):
    path = _checkpoint(tmp_path, {"hyper_parameters": {"_instantiator": "revil.evil_instantiator"}})
    with pytest.raises(Exception):
        BoringModel.load_from_checkpoint(path, strict=False)
    assert not marker.exists()


def test_instantiator_in_the_legacy_hparams_key(tmp_path, marker):
    path = _checkpoint(
        tmp_path,
        {"hyper_parameters": {}, "hparams": {"_instantiator": "revil.evil_instantiator"}},
    )
    with pytest.raises(Exception):
        BoringModel.load_from_checkpoint(path, strict=False)
    assert not marker.exists()


def test_instantiator_in_the_legacy_module_arguments_key(tmp_path, marker):
    path = _checkpoint(
        tmp_path,
        {"hyper_parameters": {}, "module_arguments": {"_instantiator": "revil.evil_instantiator"}},
    )
    with pytest.raises(Exception):
        BoringModel.load_from_checkpoint(path, strict=False)
    assert not marker.exists()


def test_instantiator_in_a_datamodule_checkpoint(tmp_path, marker):
    path = _checkpoint(
        tmp_path,
        {"datamodule_hyper_parameters": {"_instantiator": "revil.evil_instantiator"}},
    )
    with pytest.raises(Exception):
        BoringDataModule.load_from_checkpoint(path)
    assert not marker.exists()
