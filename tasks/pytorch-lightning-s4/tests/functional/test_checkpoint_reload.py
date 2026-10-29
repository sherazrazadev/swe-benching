"""Legitimate checkpoint use must keep working.

The central case is a checkpoint the library's own command line tool produced: it records the
concrete model class and typed, nested constructor arguments, and reloading it must still restore
them.  The remaining cases protect plain data, older checkpoint formats, and the caller-supplied
sources that override stored settings.
"""
from unittest import mock

import pytest
import torch
import yaml
from jsonargparse import lazy_instance
from torch.utils.data import DataLoader

import lightning.pytorch as pl
from lightning.pytorch.cli import LightningCLI
from lightning.pytorch.demos.boring_classes import BoringDataModule, BoringModel, RandomDataset


class CliModel(pl.LightningModule):
    def __init__(
        self,
        out_dim: int = 2,
        activation: torch.nn.Module = lazy_instance(torch.nn.LeakyReLU, negative_slope=0.05),
    ):
        super().__init__()
        self.save_hyperparameters()
        self.layer = torch.nn.Linear(32, out_dim)
        self.activation = activation

    def training_step(self, batch, batch_idx):
        return self.layer(batch).sum()

    def configure_optimizers(self):
        return torch.optim.Adam(self.parameters())

    def train_dataloader(self):
        return DataLoader(RandomDataset(32, 8), batch_size=4)


class CliData(BoringDataModule):
    def __init__(self, batch_size: int = 32, num_workers: int = 0):
        super().__init__()
        self.save_hyperparameters()
        self.batch_size = batch_size
        self.num_workers = num_workers


class PlainModel(BoringModel):
    def __init__(self, backbone: str = "torch.nn.Identity", note: str = "hello"):
        super().__init__()
        self.save_hyperparameters()
        self.backbone = backbone
        self.note = note


def _dotted(cls):
    return f"{cls.__module__}.{cls.__qualname__}"


@pytest.fixture(scope="session")
def cli_checkpoint(tmp_path_factory):
    root = tmp_path_factory.mktemp("cli-run")
    argv = [
        "app.py",
        "--trainer.max_epochs=1",
        f"--model={_dotted(CliModel)}",
        "--model.out_dim=3",
        f"--data={_dotted(CliData)}",
    ]
    with mock.patch("sys.argv", argv):
        cli = LightningCLI(
            CliModel,
            run=False,
            subclass_mode_model=True,
            subclass_mode_data=True,
            trainer_defaults={
                "default_root_dir": str(root),
                "logger": False,
                "enable_progress_bar": False,
                "enable_model_summary": False,
                "max_epochs": 1,
            },
        )
    cli.trainer.fit(cli.model, datamodule=cli.datamodule)
    checkpoints = list((root / "checkpoints").glob("*.ckpt"))
    assert len(checkpoints) == 1
    return checkpoints[0]


def test_cli_checkpoint_restores_the_model_class_and_typed_arguments(cli_checkpoint):
    model = pl.LightningModule.load_from_checkpoint(cli_checkpoint)
    assert type(model) is CliModel
    assert isinstance(model.activation, torch.nn.LeakyReLU)
    assert model.activation.negative_slope == 0.05
    assert model.layer.out_features == 3


def test_cli_checkpoint_restores_through_the_model_class(cli_checkpoint):
    model = CliModel.load_from_checkpoint(cli_checkpoint)
    assert type(model) is CliModel
    assert isinstance(model.activation, torch.nn.LeakyReLU)
    assert model.layer.out_features == 3


def test_cli_checkpoint_restores_the_datamodule(cli_checkpoint):
    datamodule = pl.LightningDataModule.load_from_checkpoint(cli_checkpoint)
    assert type(datamodule) is CliData
    assert datamodule.batch_size == 32


class _RestoreCLI(LightningCLI):
    """A normal CLI subclass that stops after the classes are instantiated."""

    def fit(self, *args, **kwargs):
        pass


def test_cli_checkpoint_configuration_restore_still_works(cli_checkpoint):
    argv = [
        "app.py",
        "fit",
        f"--model={_dotted(CliModel)}",
        f"--ckpt_path={cli_checkpoint}",
    ]
    with mock.patch("sys.argv", argv):
        cli = _RestoreCLI(CliModel, subclass_mode_model=True, auto_configure_optimizers=False)
    assert type(cli.model) is CliModel
    assert cli.model.layer.out_features == 3
    assert isinstance(cli.model.activation, torch.nn.LeakyReLU)


def _plain_checkpoint(tmp_path, payload):
    checkpoint = {"state_dict": {}, "pytorch-lightning_version": pl.__version__}
    checkpoint.update(payload)
    path = tmp_path / "plain.ckpt"
    torch.save(checkpoint, path)
    return path


def test_a_plain_dotted_value_is_restored_as_data(tmp_path):
    path = _plain_checkpoint(
        tmp_path,
        {"hyper_parameters": {"backbone": "torch.nn.Identity", "note": "x.y.z"}},
    )
    model = PlainModel.load_from_checkpoint(path, strict=False)
    assert model.backbone == "torch.nn.Identity"
    assert model.note == "x.y.z"


def test_an_older_checkpoint_container_name_still_loads(tmp_path):
    path = _plain_checkpoint(
        tmp_path,
        {"hyper_parameters": {"backbone": "a.b", "note": "n"}, "hparams_type": "Namespace"},
    )
    model = PlainModel.load_from_checkpoint(path, strict=False)
    assert model.backbone == "a.b"
    assert model.note == "n"


def test_a_saved_settings_file_still_overrides(tmp_path):
    path = _plain_checkpoint(
        tmp_path,
        {"hyper_parameters": {"backbone": "old", "note": "old"}},
    )
    settings = tmp_path / "settings.yaml"
    settings.write_text(yaml.safe_dump({"backbone": "new.value", "note": "from-file"}))
    model = PlainModel.load_from_checkpoint(path, strict=False, hparams_file=settings)
    assert model.backbone == "new.value"
    assert model.note == "from-file"


def test_caller_values_still_override(tmp_path):
    path = _plain_checkpoint(
        tmp_path,
        {"hyper_parameters": {"backbone": "old", "note": "old"}},
    )
    model = PlainModel.load_from_checkpoint(path, strict=False, note="from-caller")
    assert model.backbone == "old"
    assert model.note == "from-caller"
