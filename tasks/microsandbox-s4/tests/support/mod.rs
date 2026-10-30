//! Shared helpers for the hidden grading suites.
//!
//! Each case builds a sandbox configuration through the public API, starts it
//! through the public spawn entry point with a stand-in `msb` binary, and
//! records what the launched process saw. Nothing here boots a VM.

#![allow(dead_code)]

use std::collections::BTreeMap;

use base64::Engine as _;
use std::path::PathBuf;
use std::time::Duration;

use microsandbox::backend::LocalBackend;
use microsandbox::runtime::{SpawnMode, spawn_sandbox};
use microsandbox::sandbox::{SandboxBuilder, SandboxConfig};

const STUB: &str = include_str!("stub_msb.py");

/// What the launched process observed.
pub struct Dump {
    pub argv: Vec<String>,
    pub env: BTreeMap<String, String>,
    pub channels: BTreeMap<String, String>,
}

impl Dump {
    /// Every text the child received, whatever channel carried it.
    pub fn delivered(&self) -> String {
        let mut out = String::new();
        for value in &self.argv {
            out.push_str(value);
            out.push('\n');
        }
        for (key, value) in &self.env {
            out.push_str(key);
            out.push('=');
            out.push_str(value);
            out.push('\n');
        }
        for value in self.channels.values() {
            out.push_str(value);
            out.push('\n');
        }
        out
    }

    pub fn argv_joined(&self) -> String {
        self.argv.join("\n")
    }

    pub fn argv_pair(&self, flag: &str, value: &str) -> bool {
        self.argv.windows(2).any(|pair| pair == [flag, value])
    }
}

/// Decode one token that may be an encoded payload (base64 / base64url, with
/// or without `=` padding). Returns every plausible decoding.
pub fn decoded_forms(token: &str) -> Vec<String> {
    let mut candidates = vec![token.to_string()];
    if let Some((_, rhs)) = token.split_once('=') {
        candidates.push(rhs.to_string());
    }
    let mut out = Vec::new();
    for candidate in candidates {
        let trimmed = candidate.trim_end_matches('=');
        if trimmed.len() < 8 || !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '+' || c == '/') {
            continue;
        }
        for engine in [
            &base64_url_nopad(),
            &base64_std_nopad(),
        ] {
            if let Ok(bytes) = engine.decode(trimmed.as_bytes()) {
                if let Ok(text) = String::from_utf8(bytes) {
                    out.push(text);
                }
            }
        }
    }
    out
}

fn base64_url_nopad() -> base64::engine::GeneralPurpose {
    use base64::engine::GeneralPurposeConfig;
    base64::engine::GeneralPurpose::new(
        &base64::alphabet::URL_SAFE,
        GeneralPurposeConfig::new().with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent),
    )
}

fn base64_std_nopad() -> base64::engine::GeneralPurpose {
    use base64::engine::GeneralPurposeConfig;
    base64::engine::GeneralPurpose::new(
        &base64::alphabet::STANDARD,
        GeneralPurposeConfig::new().with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent),
    )
}

/// True when `marker` is readable from the launched process's command line,
/// either verbatim or after decoding a token that carries it.
pub fn secret_on_command_line(dump: &Dump, marker: &str) -> bool {
    if dump.argv_joined().contains(marker) {
        return true;
    }
    dump.argv
        .iter()
        .any(|token| decoded_forms(token).iter().any(|text| text.contains(marker)))
}

/// Decode every base64-looking run inside `text` (payloads that were encoded
/// before being put on a channel).
fn decoded_runs(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut run = String::new();
    for ch in text.chars() {
        let is_b64 = ch.is_ascii_alphanumeric() || matches!(ch, '+' | '/' | '=' | '-' | '_');
        if is_b64 {
            run.push(ch);
        } else {
            push_decoded(&run, &mut out);
            run.clear();
        }
    }
    push_decoded(&run, &mut out);
    out
}

fn push_decoded(run: &str, out: &mut Vec<String>) {
    let mut candidates = vec![run.to_string()];
    if run.contains('=') {
        candidates.extend(run.split('=').map(|part| part.to_string()));
    }
    for candidate in candidates {
        let trimmed = candidate.trim_end_matches('=');
        if trimmed.len() < 16 {
            continue;
        }
        for engine in [&base64_url_nopad(), &base64_std_nopad()] {
            if let Ok(bytes) = engine.decode(trimmed.as_bytes()) {
                if let Ok(text) = String::from_utf8(bytes) {
                    out.push(text);
                }
            }
        }
    }
}

/// True when `marker` reached the launched process through any channel.
pub fn value_delivered(dump: &Dump, marker: &str) -> bool {
    let delivered = dump.delivered();
    if delivered.contains(marker) {
        return true;
    }
    decoded_runs(&delivered)
        .iter()
        .any(|text| text.contains(marker))
}

fn install_stub(home: &std::path::Path) -> PathBuf {
    let path = home.join("msb");
    std::fs::write(&path, STUB).expect("write stub");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).expect("chmod stub");
    }
    path
}

/// Start `config` through the public spawn entry point and return what the
/// launched process observed. The stand-in binary answers the startup
/// handshake, so a correct implementation completes the call.
pub async fn spawn_and_dump(config: &SandboxConfig, mode: SpawnMode) -> Dump {
    let home = tempfile::tempdir().expect("temp home");
    let stub = install_stub(home.path());
    let dump_path = home.path().join("dump.json");
    let libkrunfw = home.path().join("libkrunfw-probe.so");
    std::fs::write(&libkrunfw, b"probe").expect("libkrunfw probe");
    // SAFETY: the suites run single-threaded (`--test-threads=1`), so mutating
    // the process environment cannot race another case.
    unsafe {
        std::env::set_var("MSB_HOME", home.path());
        std::env::set_var("MSB_PATH", &stub);
        std::env::set_var("MSB_LIBKRUNFW_PATH", &libkrunfw);
        std::env::set_var("MSB_TEST_DUMP", &dump_path);
    }

    let local = LocalBackend::lazy();
    let handle = spawn_sandbox(&local, config, 42, mode)
        .await
        .expect("the sandbox process should start");
    tokio::time::sleep(Duration::from_millis(300)).await;
    drop(handle);

    let raw = std::fs::read_to_string(&dump_path).expect("launched process should record its view");
    let value: serde_json::Value = serde_json::from_str(&raw).expect("dump is JSON");
    Dump {
        argv: value["argv"]
            .as_array()
            .expect("argv")
            .iter()
            .map(|item| item.as_str().unwrap_or_default().to_string())
            .collect(),
        env: value["env"]
            .as_object()
            .expect("env")
            .iter()
            .map(|(key, item)| (key.clone(), item.as_str().unwrap_or_default().to_string()))
            .collect(),
        channels: value["channels"]
            .as_object()
            .expect("channels")
            .iter()
            .map(|(key, item)| (key.clone(), item.as_str().unwrap_or_default().to_string()))
            .collect(),
    }
}

/// A sandbox configuration with a bind rootfs and metrics sampling disabled so
/// the launch is self-contained.
pub fn base(name: &str) -> SandboxBuilder {
    SandboxBuilder::new(name)
        .image("/msb-rootfs-probe")
        .disable_metrics_sample()
}
