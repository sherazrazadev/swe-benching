"""Legitimate keypoint-matching configurations must keep loading, binding values, and building.

These are the coupled behaviours next to the protected sinks: ordinary nested detector
configurations, harmless metadata, save/reload, and real model construction.
"""

import json
import uuid

import torch

import transformers


def _nested(**overrides):
    values = {
        "encoder_hidden_sizes": [32, 32, 64],
        "descriptor_decoder_dim": 64,
        "decoder_hidden_size": 64,
        "keypoint_decoder_dim": 65,
        "keypoint_threshold": 0.005,
        "max_keypoints": 256,
        "nms_radius": 4,
        "border_removal_distance": 4,
    }
    values.update(overrides)
    return values


def _tiny_lightglue(**overrides):
    values = {
        "keypoint_detector_config": _nested(),
        "descriptor_dim": 64,
        "num_hidden_layers": 2,
        "num_attention_heads": 4,
        "depth_confidence": 1.0,
        "width_confidence": 1.0,
        "attn_implementation": "eager",
    }
    values.update(overrides)
    return transformers.LightGlueConfig(**values)


def test_default_configuration_builds_a_builtin_detector():
    config = transformers.LightGlueConfig(attn_implementation="eager")
    detector = config.keypoint_detector_config
    assert isinstance(detector, transformers.SuperPointConfig)
    assert config.descriptor_dim == 256
    assert config.hidden_size == config.descriptor_dim
    assert config.intermediate_size == config.descriptor_dim * 2
    assert list(detector.encoder_hidden_sizes) == [64, 64, 128, 128]
    assert detector._attn_implementation == "eager"


def test_nested_detector_dict_binds_supplied_values():
    config = _tiny_lightglue()
    detector = config.keypoint_detector_config
    assert isinstance(detector, transformers.SuperPointConfig)
    assert list(detector.encoder_hidden_sizes) == [32, 32, 64]
    assert detector.descriptor_decoder_dim == 64
    assert detector.keypoint_threshold == 0.005
    assert detector.max_keypoints == 256
    assert detector._attn_implementation == "eager"


def test_nested_detector_with_harmless_origin_metadata_still_binds(tmp_path):
    config = _tiny_lightglue(keypoint_detector_config=_nested(_name_or_path=str(tmp_path)))
    detector = config.keypoint_detector_config
    assert isinstance(detector, transformers.SuperPointConfig)
    assert list(detector.encoder_hidden_sizes) == [32, 32, 64]
    assert detector.descriptor_decoder_dim == 64


def test_checkpoint_with_unused_custom_code_value_still_loads_and_builds(tmp_path):
    """The value is data, not permission: an ordinary checkpoint carrying it stays usable."""
    path = tmp_path / f"lightglue_{uuid.uuid4().hex}"
    path.mkdir()
    (path / "config.json").write_text(
        json.dumps(
            {
                "model_type": "lightglue",
                "trust_remote_code": True,
                "descriptor_dim": 64,
                "num_hidden_layers": 2,
                "num_attention_heads": 4,
                "keypoint_detector_config": _nested(),
            }
        )
    )
    config = transformers.AutoConfig.from_pretrained(str(path))
    assert isinstance(config, transformers.LightGlueConfig)
    assert isinstance(config.keypoint_detector_config, transformers.SuperPointConfig)
    assert list(config.keypoint_detector_config.encoder_hidden_sizes) == [32, 32, 64]
    model = transformers.LightGlueForKeypointMatching(config)
    assert model.keypoint_detector is not None


def test_configuration_save_and_reload_round_trip(tmp_path):
    path = tmp_path / f"saved_{uuid.uuid4().hex}"
    _tiny_lightglue().save_pretrained(str(path))
    reloaded = transformers.AutoConfig.from_pretrained(str(path))
    assert isinstance(reloaded, transformers.LightGlueConfig)
    assert isinstance(reloaded.keypoint_detector_config, transformers.SuperPointConfig)
    assert list(reloaded.keypoint_detector_config.encoder_hidden_sizes) == [32, 32, 64]
    assert reloaded.descriptor_dim == 64


def test_model_builds_and_runs_from_a_builtin_detector_configuration():
    model = transformers.LightGlueForKeypointMatching(_tiny_lightglue())
    model.eval()
    images = torch.rand(2, 2, 3, 60, 80)
    with torch.no_grad():
        output = model(images)
    assert output.mask.shape[0] == 2
    assert output.mask.shape[1] == 2


def test_superglue_configuration_and_model_build():
    default = transformers.SuperGlueConfig()
    assert isinstance(default.keypoint_detector_config, transformers.SuperPointConfig)
    config = transformers.SuperGlueConfig(
        keypoint_detector_config={
            "model_type": "superpoint",
            "encoder_hidden_sizes": [32, 32, 64],
            "descriptor_decoder_dim": 64,
        }
    )
    detector = config.keypoint_detector_config
    assert isinstance(detector, transformers.SuperPointConfig)
    assert list(detector.encoder_hidden_sizes) == [32, 32, 64]
    assert detector.descriptor_decoder_dim == 64
    model = transformers.SuperGlueForKeypointMatching(config)
    assert model.keypoint_detector is not None


def test_superglue_checkpoint_with_nested_detector_loads(tmp_path):
    path = tmp_path / f"superglue_{uuid.uuid4().hex}"
    path.mkdir()
    (path / "config.json").write_text(
        json.dumps(
            {
                "model_type": "superglue",
                "keypoint_detector_config": {
                    "model_type": "superpoint",
                    "encoder_hidden_sizes": [32, 32, 64],
                    "descriptor_decoder_dim": 64,
                },
            }
        )
    )
    config = transformers.AutoConfig.from_pretrained(str(path))
    assert isinstance(config, transformers.SuperGlueConfig)
    assert isinstance(config.keypoint_detector_config, transformers.SuperPointConfig)
    assert list(config.keypoint_detector_config.encoder_hidden_sizes) == [32, 32, 64]
