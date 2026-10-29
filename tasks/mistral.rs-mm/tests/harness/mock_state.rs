//! Test support: a minimal in-process `MistralRs` with no model, no weights and no GPU.
//!
//! The server's request-parsing path (`parse_request`) needs an `Arc<MistralRs>` but only uses
//! the engine registry for the default model id, the model category and the file store. This
//! module builds that state around a pipeline that never runs inference, so request handling can
//! be exercised in a normal unit test.

use std::any::Any;
use std::sync::Arc;

use candle_core::{DType, Device, Tensor};
use rand_isaac::Isaac64Rng;
use tokenizers::Tokenizer;

use crate::device_map::DeviceMapper;
use crate::kv_cache::{EitherCache, NormalCache};
use crate::pipeline::chat_template::ChatTemplate;
use crate::pipeline::{
    ForwardInputsResult, GeneralMetadata, ModelCategory, Modalities, Pipeline, SupportedModality,
};
use crate::prefix_cacher::PrefixCacheManagerV2;
use crate::scheduler::{DefaultSchedulerMethod, SchedulerConfig};
use crate::sequence::Sequence;
use crate::{MistralRs, MistralRsBuilder};
use mistralrs_quant::IsqType;

pub struct IdlePipeline {
    metadata: Arc<GeneralMetadata>,
    cache: EitherCache,
}

impl IdlePipeline {
    fn new() -> Self {
        Self {
            metadata: Arc::new(GeneralMetadata {
                max_seq_len: 64,
                llg_factory: None,
                no_kv_cache: true,
                no_prefix_cache: true,
                num_hidden_layers: 0,
                eos_tok: Vec::new(),
                kind: crate::pipeline::ModelKind::Normal,
                is_xlora: false,
                activation_dtype: DType::F32,
                sliding_window: None,
                cache_config: None,
                cache_engine: None,
                model_metadata: None,
                modalities: Modalities {
                    input: vec![SupportedModality::Text],
                    output: vec![SupportedModality::Text],
                },
            }),
            cache: EitherCache::Normal(NormalCache::new(0, 64)),
        }
    }
}

impl crate::pipeline::MetadataMixin for IdlePipeline {
    fn device(&self) -> Device {
        Device::Cpu
    }

    fn tokenizer(&self) -> Option<Arc<Tokenizer>> {
        None
    }

    fn name(&self) -> String {
        "idle".to_string()
    }

    fn reset_non_granular_state(&self) {}

    fn get_metadata(&self) -> Arc<GeneralMetadata> {
        self.metadata.clone()
    }

    fn device_mapper(&self) -> Option<&dyn DeviceMapper> {
        None
    }
}

impl crate::pipeline::PreProcessingMixin for IdlePipeline {
    fn get_chat_template(&self) -> Option<Arc<ChatTemplate>> {
        None
    }

    fn get_input_processor_config(&self) -> Option<Arc<dyn Any>> {
        None
    }
}

impl crate::pipeline::IsqPipelineMixin for IdlePipeline {
    fn re_isq_model(&mut self, _dtype: IsqType) -> anyhow::Result<()> {
        anyhow::bail!("idle pipeline cannot be quantized")
    }
}

impl crate::pipeline::CacheManagerMixin for IdlePipeline {
    fn clone_in_cache(&self, _seqs: &mut [&mut Sequence]) {}
    fn clone_out_cache(&self, _seqs: &mut [&mut Sequence]) {}
    fn set_none_cache(
        &self,
        _seqs: &mut [&mut Sequence],
        _reset_non_granular: bool,
        _modify_draft_cache: bool,
        _load_preallocated_cache: bool,
    ) {
    }
    fn cache(&self) -> &EitherCache {
        &self.cache
    }
}

impl crate::pipeline::AnyMoePipelineMixin for IdlePipeline {}

#[async_trait::async_trait]
impl Pipeline for IdlePipeline {
    fn forward_inputs(
        &mut self,
        _inputs: Box<dyn Any>,
        _return_raw_logits: bool,
    ) -> candle_core::Result<ForwardInputsResult> {
        candle_core::bail!("idle pipeline does not run inference")
    }

    async fn sample_causal_gen(
        &self,
        _seqs: &mut [&mut Sequence],
        _logits: Vec<Tensor>,
        _prefix_cacher: &mut PrefixCacheManagerV2,
        _disable_eos_stop: bool,
        _rng: Arc<std::sync::Mutex<Isaac64Rng>>,
    ) -> candle_core::Result<()> {
        Ok(())
    }

    fn category(&self) -> ModelCategory {
        ModelCategory::Text
    }
}

/// Build a request-handling state. Call from a current-thread Tokio runtime so the builder skips
/// its start-up inference probe.
pub async fn idle_state() -> Arc<MistralRs> {
    let pipeline: Arc<tokio::sync::Mutex<dyn Pipeline>> =
        Arc::new(tokio::sync::Mutex::new(IdlePipeline::new()));
    let method = SchedulerConfig::DefaultScheduler {
        method: DefaultSchedulerMethod::Fixed(std::num::NonZeroUsize::new(1).unwrap()),
    };
    MistralRsBuilder::new(pipeline, method, false, None)
        .build()
        .await
}
