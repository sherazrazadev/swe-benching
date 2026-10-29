//! Security suite: a model or weight file whose declared dimensions make the size arithmetic
//! overflow, or whose declared shape does not match the data it carries, must be refused with an
//! error before a tensor is created. Nothing here runs a malformed tensor; the assertion is only
//! that reading the model does not succeed.
mod common;

use common::*;

/// Plain f32: the element count fits a usize but the byte count does not.
#[test]
fn sec_dat_plain_byte_size_overflow_is_refused() {
    let file = dat(&[1 << 31, 1 << 31], 0, 32, 0, 0, &[]);
    assert!(
        tract_nnef::tensors::read_tensor(&file[..]).is_err(),
        "a tensor file whose dimensions overflow its byte count must be refused"
    );
}

/// Plain f64: a different element width reaches the same sink.
#[test]
fn sec_dat_wide_element_overflow_is_refused() {
    let file = dat(&[1 << 31, 1 << 31], 0, 64, 0, 0, &[]);
    assert!(
        tract_nnef::tensors::read_tensor(&file[..]).is_err(),
        "a tensor file whose dimensions overflow its byte count must be refused"
    );
}

/// Plain u8: the element count itself does not fit a usize.
#[test]
fn sec_dat_element_count_overflow_is_refused() {
    let file = dat(&[1 << 31, 1 << 31, 1 << 31], 0, 8, 1, 0, &[]);
    assert!(
        tract_nnef::tensors::read_tensor(&file[..]).is_err(),
        "a tensor file whose element count overflows must be refused"
    );
}

/// The same file reaching the loader through a model directory.
#[test]
fn sec_nnef_model_dat_overflow_is_refused() {
    let graph = "version 1.0;\n\nextension tract_registry tract_core;\n\n\
                 graph net() -> (output_0)\n{\n    \
                 output_0 = variable(label = 'w', shape = [2147483648, 2147483648]);\n}\n";
    let dir = nnef_model(
        "sec-model-overflow",
        graph,
        &[("w.dat", dat(&[1 << 31, 1 << 31], 0, 32, 0, 0, &[]))],
    );
    match load_nnef(&dir) {
        Ok(Err(_)) => {}
        Ok(Ok(_)) => panic!("a model with an overflowing tensor dimension was loaded"),
        Err(()) => panic!("the loader crashed instead of refusing the model"),
    }
}

/// A block-quantized file whose declared dimensions overflow the block byte count.
#[test]
fn sec_block_quant_header_byte_size_overflow_is_refused() {
    let file = dat(
        &[4294760058, 3817932928],
        11936,
        u32::MAX,
        0x3080,
        TRACT_VENDOR,
        &vec![0u8; 11936],
    );
    assert!(
        tract_nnef::tensors::read_tensor(&file[..]).is_err(),
        "a block-quantized tensor file whose dimensions overflow its byte count must be refused"
    );
}

/// A block-quantized tensor whose stored payload does not match the shape the model declares.
#[test]
fn sec_block_quant_graph_shape_mismatch_is_refused() {
    let graph = "version 1.0;\n\nextension tract_registry tract_core;\n\n\
                 graph net() -> (output_0)\n{\n    \
                 output_0 = variable(label = 'w', shape = [2147483648, 2147483648]);\n}\n";
    let dir = nnef_model(
        "sec-blockquant-shape",
        graph,
        &[("w.dat", dat(&[1, 32], 18, u32::MAX, 0x3040, TRACT_VENDOR, &[0u8; 18]))],
    );
    match load_nnef(&dir) {
        Ok(Err(_)) => {}
        Ok(Ok(_)) => {
            panic!("a block-quantized tensor whose payload does not match its shape was loaded")
        }
        Err(()) => panic!("the loader crashed instead of refusing the model"),
    }
}

/// A model in another serialization format whose tensor dimensions overflow its byte count.
#[test]
fn sec_onnx_tensor_byte_size_overflow_is_refused() {
    let dims: [i64; 8] = [2, 2, 2, 3, 2833, 37171, 1824726041, 4];
    let bytes = onnx_single_initializer(
        &dims,
        tract_onnx::pb::tensor_proto::DataType::Float as i32,
        &[0u8; 128],
        None,
    );
    let dir = temp_dir("sec-onnx-overflow");
    let path = dir.join("model.onnx");
    std::fs::write(&path, bytes).expect("writing the model");
    match load_onnx(&path) {
        Ok(Err(_)) => {}
        Ok(Ok(_)) => panic!("a model with an overflowing tensor dimension was loaded"),
        Err(()) => panic!("the loader crashed instead of refusing the model"),
    }
}

/// A bundled weight whose declared element count matches its shape but whose byte count does not
/// fit.
#[test]
fn sec_bundle_tensor_byte_size_overflow_is_refused() {
    let file = bundle(&[BundleTensor {
        name: "w",
        dims: &[1 << 31, 1 << 31],
        elem_size: 4,
        elem_count: (1u64 << 31) * (1u64 << 31),
        payload: &[],
    }]);
    let graph = "version 1.0;\n\nextension tract_registry tract_core;\n\n\
                 graph net() -> (output_0)\n{\n    \
                 output_0 = variable(label = 'w', shape = [2147483648, 2147483648]);\n}\n";
    let dir = nnef_model("sec-bundle-overflow", graph, &[("w.tbundle", file)]);
    match load_nnef(&dir) {
        Ok(Err(_)) => {}
        Ok(Ok(_)) => panic!("a bundled weight whose byte count overflows was loaded"),
        Err(()) => panic!("the loader crashed instead of refusing the model"),
    }
}

/// A legacy single-tensor weight file whose declared element count matches its shape but whose byte
/// count does not fit.
#[test]
fn sec_legacy_tensor_byte_size_overflow_is_refused() {
    let file = legacy_tensor(&[1 << 31, 1 << 31], 4, (1u64 << 31) * (1u64 << 31), &[]);
    let graph = "version 1.0;\n\nextension tract_registry tract_core;\n\n\
                 graph net() -> (output_0)\n{\n    \
                 output_0 = variable(label = 'w', shape = [2147483648, 2147483648]);\n}\n";
    let dir = nnef_model("sec-legacy-overflow", graph, &[("w.tensor", file)]);
    match load_nnef(&dir) {
        Ok(Err(_)) => {}
        Ok(Ok(_)) => panic!("a legacy weight file whose byte count overflows was loaded"),
        Err(()) => panic!("the loader crashed instead of refusing the model"),
    }
}
