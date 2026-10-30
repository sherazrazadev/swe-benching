"""A checkpoint's own values must never cause code from a checkpoint-named location to run.

Every test builds a local checkpoint directory (no network) whose JSON configuration points at a
harmless probe module that writes a marker file when imported. The attack is blocked when the
marker never appears, whether the library refuses the checkpoint or continues with built-in
components only.
"""

import json
import uuid

import transformers


def _write_probe(tmp_path, kind):
    """Create a harmless module that records its own import, plus the config that points at it."""
    tag = uuid.uuid4().hex
    probe = tmp_path / f"probe_{kind}_{tag}"
    probe.mkdir()
    marker = probe / "EXECUTED"
    if kind == "config":
        source = (
            "from pathlib import Path\n"
            f"Path({str(marker)!r}).write_text('executed')\n"
            "from transformers.configuration_utils import PreTrainedConfig\n"
            "class ProbeConfig(PreTrainedConfig):\n"
            "    model_type = 'probe_config'\n"
        )
        auto_map = {"AutoConfig": "probe_module.ProbeConfig"}
        model_type = "probe_config"
    else:
        source = (
            "from pathlib import Path\n"
            f"Path({str(marker)!r}).write_text('executed')\n"
            "class ProbeDetector:\n"
            "    @classmethod\n"
            "    def _from_config(cls, config, **kwargs):\n"
            "        return cls()\n"
        )
        auto_map = {"AutoModelForKeypointDetection": "probe_module.ProbeDetector"}
        model_type = "probe_detector"
    (probe / "probe_module.py").write_text(source)
    (probe / "config.json").write_text(json.dumps({"model_type": model_type, "auto_map": auto_map}))
    return probe, marker


def _checkpoint(tmp_path, model_type, detector, **extra):
    path = tmp_path / f"{model_type}_{uuid.uuid4().hex}"
    path.mkdir()
    config = {"model_type": model_type, "trust_remote_code": True, "keypoint_detector_config": detector}
    config.update(extra)
    (path / "config.json").write_text(json.dumps(config))
    return path


def _lightglue_checkpoint(tmp_path, detector):
    return _checkpoint(
        tmp_path,
        "lightglue",
        detector,
        descriptor_dim=64,
        num_hidden_layers=2,
        num_attention_heads=4,
    )


def _attempt(call):
    """Run one load; either a clean refusal or a safe continuation is acceptable."""
    try:
        call()
    except Exception:
        pass


def test_configuration_auto_class_does_not_run_checkpoint_code(tmp_path):
    probe, marker = _write_probe(tmp_path, "config")
    checkpoint = _lightglue_checkpoint(
        tmp_path,
        {"model_type": f"unregistered_detector_{uuid.uuid4().hex}", "_name_or_path": str(probe)},
    )
    _attempt(lambda: transformers.AutoConfig.from_pretrained(str(checkpoint)))
    assert not marker.exists(), "a checkpoint value ran code while its configuration was read"


def test_configuration_class_does_not_run_checkpoint_code(tmp_path):
    probe, marker = _write_probe(tmp_path, "config")
    checkpoint = _lightglue_checkpoint(
        tmp_path,
        {"model_type": f"unregistered_detector_{uuid.uuid4().hex}", "_name_or_path": str(probe)},
    )
    _attempt(lambda: transformers.LightGlueConfig.from_pretrained(str(checkpoint)))
    assert not marker.exists(), "a checkpoint value ran code through the configuration class"


def test_model_auto_class_does_not_run_checkpoint_code(tmp_path):
    probe, marker = _write_probe(tmp_path, "model")
    checkpoint = _lightglue_checkpoint(
        tmp_path,
        {
            "model_type": "superpoint",
            "_name_or_path": str(probe),
            "auto_map": {"AutoModelForKeypointDetection": "probe_module.ProbeDetector"},
            "encoder_hidden_sizes": [32, 32, 64],
            "descriptor_decoder_dim": 64,
        },
    )

    def attack():
        config = transformers.AutoConfig.from_pretrained(str(checkpoint))
        transformers.AutoModelForKeypointMatching.from_config(config)

    _attempt(attack)
    assert not marker.exists(), "a nested checkpoint value ran code while the model was built"


def test_direct_model_construction_does_not_run_checkpoint_code(tmp_path):
    probe, marker = _write_probe(tmp_path, "model")
    checkpoint = _lightglue_checkpoint(
        tmp_path,
        {
            "model_type": "superpoint",
            "_name_or_path": str(probe),
            "auto_map": {"AutoModelForKeypointDetection": "probe_module.ProbeDetector"},
            "encoder_hidden_sizes": [32, 32, 64],
            "descriptor_decoder_dim": 64,
        },
    )

    def attack():
        config = transformers.AutoConfig.from_pretrained(str(checkpoint))
        transformers.LightGlueForKeypointMatching(config)

    _attempt(attack)
    assert not marker.exists(), "a nested checkpoint value ran code through the model constructor"


def test_superglue_configuration_does_not_run_checkpoint_code(tmp_path):
    probe, marker = _write_probe(tmp_path, "config")
    checkpoint = _checkpoint(
        tmp_path,
        "superglue",
        {"model_type": f"unregistered_detector_{uuid.uuid4().hex}", "_name_or_path": str(probe)},
    )
    _attempt(lambda: transformers.AutoConfig.from_pretrained(str(checkpoint)))
    assert not marker.exists(), "a checkpoint value ran code while the sibling configuration was read"


def test_superglue_model_does_not_run_checkpoint_code(tmp_path):
    probe, marker = _write_probe(tmp_path, "model")
    checkpoint = _checkpoint(
        tmp_path,
        "superglue",
        {
            "model_type": "superpoint",
            "_name_or_path": str(probe),
            "auto_map": {"AutoModelForKeypointDetection": "probe_module.ProbeDetector"},
        },
    )

    def attack():
        config = transformers.AutoConfig.from_pretrained(str(checkpoint))
        transformers.AutoModelForKeypointMatching.from_config(config)

    _attempt(attack)
    assert not marker.exists(), "a nested checkpoint value ran code while the sibling model was built"
