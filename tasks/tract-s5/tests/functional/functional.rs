//! Functional suite: everything a legitimate model or weight file does today keeps working.
mod common;

use common::*;
use tract_nnef::prelude::*;

/// A packed one-bit boolean tensor: one byte per eight values, a trailing partial byte allowed.
#[test]
fn fun_dat_packed_bool_loads() {
    let payload = vec![0b1010_1010u8, 0b1111_0000u8];
    let file = dat(&[12], 2, 1, 5, 0, &payload);
    let t = tract_nnef::tensors::read_tensor(&file[..]).expect("a packed boolean tensor must load");
    assert_eq!(t.shape(), &[12]);
    assert_eq!(t.datum_type(), DatumType::Bool);
    let v = t.try_as_plain().expect("plain boolean tensor").as_slice::<bool>().expect("typed").to_vec();
    let expected: Vec<bool> = [1u8, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1]
        .iter()
        .map(|b| *b != 0)
        .collect();
    assert_eq!(v, expected);
}

/// A tensor with a zero-length dimension is a legitimate empty tensor.
#[test]
fn fun_dat_zero_length_dimension_loads() {
    let file = dat(&[0, 4], 0, 32, 0, 0, &[]);
    let t = tract_nnef::tensors::read_tensor(&file[..]).expect("an empty tensor must load");
    assert_eq!(t.shape(), &[0, 4]);
    assert_eq!(t.len(), 0);
}

/// A rank-0 tensor holds exactly one value.
#[test]
fn fun_dat_rank_zero_loads() {
    let file = dat(&[], 4, 32, 0, 0, &7.5f32.to_le_bytes());
    let t = tract_nnef::tensors::read_tensor(&file[..]).expect("a rank-0 tensor must load");
    assert_eq!(t.shape(), &[] as &[usize]);
    assert_eq!(t.len(), 1);
    let v = t.try_as_plain().expect("plain tensor").as_slice::<f32>().expect("typed")[0];
    assert_eq!(v, 7.5);
}

/// A tensor written by the library reads back unchanged.
#[test]
fn fun_dat_plain_round_trip() {
    let t = tensor2(&[[1.0f32, -2.0], [3.5, 4.25]]);
    let mut buf = Vec::new();
    tract_nnef::tensors::write_tensor(&mut buf, &t).expect("writing a tensor");
    let read = tract_nnef::tensors::read_tensor(&buf[..]).expect("reading it back");
    assert_eq!(read.shape(), t.shape());
    assert_eq!(read.datum_type(), t.datum_type());
    assert_eq!(
        read.try_as_plain().expect("plain").as_slice::<f32>().expect("typed"),
        t.try_as_plain().expect("plain").as_slice::<f32>().expect("typed")
    );
}

/// A Q4_0 file stores 18 bytes per 32 values, not four bytes per value.
#[test]
fn fun_dat_block_quant_q4_0_loads() {
    let file = dat(&[2, 32], 36, u32::MAX, 0x3040, TRACT_VENDOR, &vec![0u8; 36]);
    let t = tract_nnef::tensors::read_tensor(&file[..]).expect("a Q4_0 tensor file must load");
    assert_eq!(t.shape(), &[2, 32]);
    assert_eq!(t.len(), 64);
}

/// A Q8_1 file stores 36 bytes per 32 values.
#[test]
fn fun_dat_block_quant_q8_1_loads() {
    let file = dat(&[1, 32], 36, u32::MAX, 0x3080, TRACT_VENDOR, &vec![0u8; 36]);
    let t = tract_nnef::tensors::read_tensor(&file[..]).expect("a Q8_1 tensor file must load");
    assert_eq!(t.shape(), &[1, 32]);
}

/// A plain model whose tensor file matches the shape the graph declares still loads and runs.
#[test]
fn fun_nnef_model_plain_loads_and_runs() {
    let dir = nnef_model(
        "fun-model-plain",
        ADD_GRAPH,
        &[("w.dat", dat(&[2, 3], 24, 32, 0, 0, &w_bytes()))],
    );
    let model = match load_nnef(&dir) {
        Ok(Ok(m)) => m,
        Ok(Err(e)) => panic!("a legitimate model was refused: {e}"),
        Err(()) => panic!("the loader crashed on a legitimate model"),
    };
    let input = tensor2(&[[1.0f32, 2.0, 3.0], [4.0, 5.0, 6.0]]);
    let got = run_add_graph(model, input);
    assert_eq!(got, vec![11.0, 22.0, 33.0, 44.0, 55.0, 66.0]);
}

/// A block-quantized tensor file stores the flattened matrix; the graph may declare a higher rank
/// whose trailing dimension is the same. That stays authoritative and must keep loading.
#[test]
fn fun_nnef_model_block_quant_unflattened_shape_loads() {
    let graph = "version 1.0;\n\nextension tract_registry tract_core;\n\n\
                 graph net() -> (output_0)\n{\n    \
                 output_0 = variable(label = 'w', shape = [2, 16, 96]);\n}\n";
    let dir = nnef_model(
        "fun-model-bq-rank3",
        graph,
        &[("w.dat", dat(&[32, 96], 1728, u32::MAX, 0x3040, TRACT_VENDOR, &vec![0u8; 1728]))],
    );
    match load_nnef(&dir) {
        Ok(Ok(_)) => {}
        Ok(Err(e)) => panic!("a legitimate block-quantized model was refused: {e}"),
        Err(()) => panic!("the loader crashed on a legitimate block-quantized model"),
    }
}

/// A model in another serialization format whose tensor payload matches its declared shape loads
/// and produces the stored values.
#[test]
fn fun_onnx_raw_tensor_loads_and_runs() {
    use tract_onnx::tract_hir::prelude::InferenceModelExt;
    let values = [1.0f32, -2.5, 3.25, 4.75];
    let raw: Vec<u8> = values.iter().flat_map(|v| v.to_le_bytes()).collect();
    let bytes = onnx_single_initializer(
        &[2, 2],
        tract_onnx::pb::tensor_proto::DataType::Float as i32,
        &raw,
        None,
    );
    let dir = temp_dir("fun-onnx");
    let path = dir.join("model.onnx");
    std::fs::write(&path, bytes).expect("writing the model");
    let model = match load_onnx(&path) {
        Ok(Ok(m)) => m,
        Ok(Err(e)) => panic!("a legitimate model was refused: {e}"),
        Err(()) => panic!("the loader crashed on a legitimate model"),
    };
    let runnable = model.into_optimized().expect("optimising").into_runnable().expect("building");
    let out = runnable.run(tvec!()).expect("running");
    let got: Vec<f32> =
        out[0].to_plain_array_view::<f32>().expect("plain output").iter().copied().collect();
    assert_eq!(got, values.to_vec());
}

/// A legitimate weight bundle with a matching shape loads and runs.
#[test]
fn fun_bundle_model_loads_and_runs() {
    let payload = w_bytes();
    let file = bundle(&[BundleTensor {
        name: "w",
        dims: &[2, 3],
        elem_size: 4,
        elem_count: 6,
        payload: &payload,
    }]);
    let dir = nnef_model("fun-bundle", ADD_GRAPH, &[("w.tbundle", file)]);
    let model = match load_nnef(&dir) {
        Ok(Ok(m)) => m,
        Ok(Err(e)) => panic!("a legitimate bundle was refused: {e}"),
        Err(()) => panic!("the loader crashed on a legitimate bundle"),
    };
    let input = tensor2(&[[1.0f32, 2.0, 3.0], [4.0, 5.0, 6.0]]);
    let got = run_add_graph(model, input);
    assert_eq!(got, vec![11.0, 22.0, 33.0, 44.0, 55.0, 66.0]);
}

/// A legitimate legacy weight file with a matching shape loads and runs.
#[test]
fn fun_legacy_tensor_model_loads_and_runs() {
    let payload = w_bytes();
    let file = legacy_tensor(&[2, 3], 4, 6, &payload);
    let dir = nnef_model("fun-legacy", ADD_GRAPH, &[("w.tensor", file)]);
    let model = match load_nnef(&dir) {
        Ok(Ok(m)) => m,
        Ok(Err(e)) => panic!("a legitimate legacy weight file was refused: {e}"),
        Err(()) => panic!("the loader crashed on a legitimate legacy weight file"),
    };
    let input = tensor2(&[[1.0f32, 2.0, 3.0], [4.0, 5.0, 6.0]]);
    let got = run_add_graph(model, input);
    assert_eq!(got, vec![11.0, 22.0, 33.0, 44.0, 55.0, 66.0]);
}
