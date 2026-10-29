#![allow(dead_code)]

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::task::JoinHandle;

use mistralrs_server_core::chat_completion::{parse_request, ChatCompletionParseContext};
use mistralrs_server_core::openai::{ChatCompletionRequest, OpenAiToolSurface};

/// A 1x1 PNG.
pub const PNG_B64: &str =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
/// A 1-sample 8 kHz WAV (the shape the project's own media test uses).
pub const WAV_B64: &str = "UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==";
/// A 1x1 single-frame GIF.
pub const GIF_B64: &str = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

pub fn b64(s: &str) -> Vec<u8> {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::new();
    let mut buf = 0u32;
    let mut bits = 0u32;
    for c in s.bytes() {
        if c == b'=' || c.is_ascii_whitespace() {
            continue;
        }
        let Some(v) = T.iter().position(|&x| x == c) else {
            continue;
        };
        buf = (buf << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    out
}

pub fn data_url(mime: &str, b64_payload: &str) -> String {
    format!("data:{mime};base64,{b64_payload}")
}

/// Write a fixture into a fresh per-test directory and return its absolute path.
pub fn fixture(name: &str, bytes: &[u8]) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "mistralrs-media-{}-{}",
        std::process::id(),
        name.replace('/', "_")
    ));
    std::fs::create_dir_all(&dir).expect("create fixture dir");
    let path = dir.join(name);
    std::fs::write(&path, bytes).expect("write fixture");
    path
}

fn file_url(path: &std::path::Path) -> String {
    format!("file://{}", path.display())
}

pub fn image_part(url: &str) -> Value {
    json!({"type": "image_url", "image_url": {"url": url}})
}

pub fn audio_part(url: &str) -> Value {
    json!({"type": "audio_url", "audio_url": {"url": url}})
}

pub fn video_part(url: &str) -> Value {
    json!({"type": "video_url", "video_url": {"url": url}})
}

pub fn file_part(spec: Value) -> Value {
    json!({"type": "file", "file": spec})
}

pub fn chat_body(part: Value) -> Value {
    json!({
        "model": "default",
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": "describe this"},
                part
            ]
        }]
    })
}

/// Drive the server's request parser exactly as the HTTP handlers do: deserialize the JSON
/// body, then hand it to `parse_request` with the surface the route uses.
pub async fn parse_body(body: Value, surface: OpenAiToolSurface) -> anyhow::Result<()> {
    let request: ChatCompletionRequest = serde_json::from_value(body)?;
    let state = mistralrs_core::mock_state::idle_state().await;
    let (tx, _rx) = tokio::sync::mpsc::channel(8);
    parse_request(
        request,
        ChatCompletionParseContext {
            state,
            tx,
            tool_dispatch_url: None,
            agent_approval_handler: None,
            agent_approval_notifier: None,
            tool_surface: surface,
            skill_store: None,
        },
    )
    .await
    .map(|_| ())
}

pub async fn parse_chat(body: Value) -> anyhow::Result<()> {
    parse_body(body, OpenAiToolSurface::ChatCompletions).await
}

pub async fn parse_responses(body: Value) -> anyhow::Result<()> {
    parse_body(body, OpenAiToolSurface::Responses).await
}

/// A tiny one-shot HTTP endpoint bound to a loopback address. It counts every completed
/// request so a test can prove that the server never connected.
pub struct LoopbackHttp {
    pub port: u16,
    pub hits: Arc<AtomicUsize>,
    stop: Option<tokio::sync::oneshot::Sender<()>>,
    join: Option<JoinHandle<()>>,
}

impl LoopbackHttp {
    pub async fn start(bind: &str, body: Vec<u8>, content_type: &'static str) -> Self {
        let listener = TcpListener::bind(bind).await.expect("bind loopback server");
        let addr = listener.local_addr().expect("local addr");
        let hits = Arc::new(AtomicUsize::new(0));
        let (stop, mut stopped) = tokio::sync::oneshot::channel::<()>();
        let hits_for_task = hits.clone();
        let join = tokio::spawn(async move {
            loop {
                let accepted = tokio::select! {
                    _ = &mut stopped => break,
                    accepted = listener.accept() => accepted,
                };
                let Ok((mut socket, _peer)) = accepted else {
                    continue;
                };
                let body = body.clone();
                let hits = hits_for_task.clone();
                tokio::spawn(async move {
                    let mut buf = vec![0u8; 8192];
                    let mut seen = 0;
                    loop {
                        match socket.read(&mut buf[seen..]).await {
                            Ok(0) | Err(_) => break,
                            Ok(n) => seen += n,
                        }
                        if seen >= 4 && buf[..seen].windows(4).any(|w| w == b"\r\n\r\n") {
                            break;
                        }
                        if seen == buf.len() {
                            break;
                        }
                    }
                    hits.fetch_add(1, Ordering::SeqCst);
                    let head = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    );
                    let _ = socket.write_all(head.as_bytes()).await;
                    let _ = socket.write_all(&body).await;
                    let _ = socket.shutdown().await;
                });
            }
        });
        Self {
            port: addr.port(),
            hits,
            stop: Some(stop),
            join: Some(join),
        }
    }

    pub fn url(&self, host: &str, path: &str) -> String {
        format!("http://{host}:{}/{}", self.port, path.trim_start_matches('/'))
    }

    pub fn hits(&self) -> usize {
        self.hits.load(Ordering::SeqCst)
    }
}

impl Drop for LoopbackHttp {
    fn drop(&mut self) {
        if let Some(stop) = self.stop.take() {
            let _ = stop.send(());
        }
        if let Some(join) = self.join.take() {
            join.abort();
        }
    }
}
