//! Helpers shared by the hidden suites.
//!
//! Every fixture is built here from first principles (a 128-byte NNEF tensor header, a legacy
//! header, a weight-bundle index, an ONNX protobuf) so that no expected value is computed with the
//! code under test.
#![allow(dead_code)]

use std::path::{Path, PathBuf};

use tract_nnef::prelude::*;

pub const TRACT_VENDOR: u16 = ((b'T' as u16) << 8) | b'R' as u16;

/// Build an NNEF tensor file: 128-byte header (magic, version, byte count, rank, dims,
/// bits per item, item type, vendor) followed by `payload`.
pub fn dat(
    dims: &[u32],
    data_size_bytes: u32,
    bits_per_item: u32,
    item_type: u16,
    vendor: u16,
    payload: &[u8],
) -> Vec<u8> {
    assert!(dims.len() <= 8);
    let mut h = vec![0u8; 128];
    h[0] = 0x4e;
    h[1] = 0xef;
    h[2] = 1;
    h[3] = 0;
    h[4..8].copy_from_slice(&data_size_bytes.to_le_bytes());
    h[8..12].copy_from_slice(&(dims.len() as u32).to_le_bytes());
    for (i, d) in dims.iter().enumerate() {
        h[12 + 4 * i..16 + 4 * i].copy_from_slice(&d.to_le_bytes());
    }
    h[44..48].copy_from_slice(&bits_per_item.to_le_bytes());
    h[48..50].copy_from_slice(&item_type.to_le_bytes());
    h[50..52].copy_from_slice(&vendor.to_le_bytes());
    h.extend_from_slice(payload);
    h
}

/// One entry of a weight bundle.
pub struct BundleTensor<'a> {
    pub name: &'a str,
    pub dims: &'a [u32],
    pub elem_size: u8,
    pub elem_count: u64,
    pub payload: &'a [u8],
}

/// Build a `TBND` weight bundle: a 12-byte header, one index record per tensor, then the payloads.
pub fn bundle(tensors: &[BundleTensor]) -> Vec<u8> {
    let entry_len = |t: &BundleTensor| {
        4 + t.name.len() + 4 + 4 * t.dims.len() + 1 + 3 + 8 + 8 + 8
    };
    let data_start: usize = 12 + tensors.iter().map(entry_len).sum::<usize>();
    let mut out = Vec::new();
    out.extend_from_slice(b"TBND");
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    out.extend_from_slice(&(tensors.len() as u32).to_le_bytes());
    let mut offset = data_start;
    for t in tensors {
        out.extend_from_slice(&(t.name.len() as u32).to_le_bytes());
        out.extend_from_slice(t.name.as_bytes());
        out.extend_from_slice(&(t.dims.len() as u32).to_le_bytes());
        for d in t.dims {
            out.extend_from_slice(&d.to_le_bytes());
        }
        out.push(t.elem_size);
        out.extend_from_slice(&[0, 0, 0]);
        out.extend_from_slice(&t.elem_count.to_le_bytes());
        out.extend_from_slice(&(offset as u64).to_le_bytes());
        out.extend_from_slice(&(t.payload.len() as u64).to_le_bytes());
        offset += t.payload.len();
    }
    for t in tensors {
        out.extend_from_slice(t.payload);
    }
    out
}

/// Build a legacy `TRT0` single-tensor file: 48-byte header followed by the raw payload.
pub fn legacy_tensor(dims: &[u32], elem_size: u8, elem_count: u64, payload: &[u8]) -> Vec<u8> {
    assert!(dims.len() <= 8);
    let mut out = vec![0u8; 48];
    out[0..4].copy_from_slice(b"TRT0");
    out[4] = elem_size;
    out[5] = dims.len() as u8;
    for (i, d) in dims.iter().enumerate() {
        out[8 + 4 * i..12 + 4 * i].copy_from_slice(&d.to_le_bytes());
    }
    out[40..48].copy_from_slice(&elem_count.to_le_bytes());
    out.extend_from_slice(payload);
    out
}

/// A fresh directory for one test, keyed by name and process so parallel tests never collide.
pub fn temp_dir(name: &str) -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push(format!("tract-fixture-{}-{}", name, std::process::id()));
    let _ = std::fs::remove_dir_all(&p);
    std::fs::create_dir_all(&p).expect("creating the fixture directory");
    p
}

/// Write an NNEF model directory: `graph.nnef` plus one file per tensor.
pub fn nnef_model(name: &str, graph: &str, files: &[(&str, Vec<u8>)]) -> PathBuf {
    let dir = temp_dir(name);
    std::fs::write(dir.join("graph.nnef"), graph).expect("writing graph.nnef");
    for (f, content) in files {
        std::fs::write(dir.join(f), content).expect("writing a tensor file");
    }
    dir
}

/// Load an NNEF model. Outer `Err(())` means the loader panicked: a crash is not a refusal.
pub fn load_nnef(dir: &Path) -> Result<TractResult<TypedModel>, ()> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        tract_nnef::nnef().model_for_path(dir)
    }))
    .map_err(|_| ())
}

/// Load an ONNX model. Outer `Err(())` means the loader panicked.
pub fn load_onnx(
    path: &Path,
) -> Result<TractResult<tract_onnx::tract_hir::prelude::InferenceModel>, ()> {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        tract_onnx::onnx().model_for_path(path)
    }))
    .map_err(|_| ())
}

/// Encode an ONNX model holding a single initializer named `w`, exposed as the graph output.
/// `dims` and `raw` are the initializer's declared shape and stored payload; `external` names a
/// side file (created empty when present) instead of inline data.
pub fn onnx_single_initializer(
    dims: &[i64],
    data_type: i32,
    raw: &[u8],
    external: Option<&str>,
) -> Vec<u8> {
    use prost::Message;
    use tract_onnx::pb;

    let tensor = pb::TensorProto {
        dims: dims.to_vec(),
        data_type,
        raw_data: raw.to_vec(),
        name: "w".into(),
        data_location: external
            .map(|_| pb::tensor_proto::DataLocation::External as i32),
        external_data: external
            .map(|f| vec![pb::StringStringEntryProto { key: "location".into(), value: f.into() }])
            .unwrap_or_default(),
        ..Default::default()
    };
    let graph = pb::GraphProto {
        name: "g".into(),
        initializer: vec![tensor],
        output: vec![pb::ValueInfoProto { name: "w".into(), ..Default::default() }],
        ..Default::default()
    };
    let model = pb::ModelProto {
        ir_version: 8,
        graph: Some(graph),
        opset_import: vec![pb::OperatorSetIdProto { domain: "".into(), version: 13 }],
        ..Default::default()
    };
    model.encode_to_vec()
}

/// The graph used by the loader tests: an external f32 input added to a `[2, 3]` weight `w`.
pub const ADD_GRAPH: &str = "version 1.0;\n\nextension tract_registry tract_core;\n\n\
     graph net(input_0) -> (output_0)\n{\n    \
     input_0 = tract_core_external(shape = [2, 3], datum_type = 'f32');\n    \
     w = variable(label = 'w', shape = [2, 3]);\n    \
     output_0 = add(input_0, w);\n}\n";

/// Run `ADD_GRAPH` with the given input and return the output values.
pub fn run_add_graph(model: TypedModel, input: Tensor) -> Vec<f32> {
    let runnable = model.into_optimized().expect("optimising").into_runnable().expect("building");
    let out = runnable.run(tvec!(input.into())).expect("running");
    out[0].to_plain_array_view::<f32>().expect("plain output").iter().copied().collect()
}

/// The six f32 values used as the `w` payload in the legitimate loader tests.
pub fn w_values() -> Vec<f32> {
    vec![10.0, 20.0, 30.0, 40.0, 50.0, 60.0]
}

/// The little-endian bytes of `w_values`.
pub fn w_bytes() -> Vec<u8> {
    w_values().iter().flat_map(|v| v.to_le_bytes()).collect()
}
