mod common;

use common::*;

/// Hostname that the harness maps to the loopback interface before the suite runs.
const LOOPBACK_HOST: &str = "media-preview.internal";

#[tokio::test]
async fn sec_image_loopback_endpoint_is_refused() {
    let srv = LoopbackHttp::start("127.0.0.1:0", b64(PNG_B64), "image/png").await;
    let result = parse_chat(chat_body(image_part(&srv.url("127.0.0.1", "one.png")))).await;
    assert!(
        result.is_err(),
        "the server accepted an image source that points at its own loopback interface"
    );
    assert_eq!(srv.hits(), 0, "the server connected to the loopback endpoint");
}

#[tokio::test]
async fn sec_image_loopback_hostname_is_refused() {
    let srv = LoopbackHttp::start("127.0.0.1:0", b64(PNG_B64), "image/png").await;
    let result = parse_chat(chat_body(image_part(&srv.url(LOOPBACK_HOST, "one.png")))).await;
    assert!(
        result.is_err(),
        "the server accepted a host name that resolves to its own loopback interface"
    );
    assert_eq!(srv.hits(), 0, "the server connected to the loopback endpoint");
}

#[tokio::test]
async fn sec_image_mapped_ipv6_loopback_is_refused() {
    let srv = LoopbackHttp::start("127.0.0.1:0", b64(PNG_B64), "image/png").await;
    let url = format!("http://[::ffff:127.0.0.1]:{}/one.png", srv.port);
    let result = parse_chat(chat_body(image_part(&url))).await;
    assert!(
        result.is_err(),
        "the server accepted an IPv4-mapped IPv6 loopback address as an image source"
    );
    assert_eq!(srv.hits(), 0, "the server connected to the loopback endpoint");
}

#[tokio::test]
async fn sec_image_server_local_path_is_refused() {
    let path = fixture("secret.png", &b64(PNG_B64));
    let result = parse_chat(chat_body(image_part(path.to_str().unwrap()))).await;
    assert!(
        result.is_err(),
        "the server accepted a bare server-local path as an image source"
    );
}

#[tokio::test]
async fn sec_image_server_local_file_url_is_refused() {
    let path = fixture("secret-url.png", &b64(PNG_B64));
    let url = format!("file://{}", path.display());
    let result = parse_chat(chat_body(image_part(&url))).await;
    assert!(
        result.is_err(),
        "the server accepted a file URL as an image source"
    );
}

#[tokio::test]
async fn sec_image_local_path_field_is_refused() {
    let path = fixture("secret-field.png", &b64(PNG_B64));
    let part = serde_json::json!({
        "type": "image_url",
        "image_url": {"path": path.to_str().unwrap()}
    });
    let result = parse_chat(chat_body(part)).await;
    assert!(
        result.is_err(),
        "the server accepted a server-local path supplied through an image content object"
    );
}

#[tokio::test]
async fn sec_audio_loopback_endpoint_is_refused() {
    let srv = LoopbackHttp::start("127.0.0.1:0", b64(WAV_B64), "audio/wav").await;
    let result = parse_chat(chat_body(audio_part(&srv.url("127.0.0.1", "one.wav")))).await;
    assert!(
        result.is_err(),
        "the server accepted an audio source that points at its own loopback interface"
    );
    assert_eq!(srv.hits(), 0, "the server connected to the loopback endpoint");
}

#[tokio::test]
async fn sec_audio_server_local_path_is_refused() {
    let path = fixture("secret.wav", &b64(WAV_B64));
    let result = parse_chat(chat_body(audio_part(path.to_str().unwrap()))).await;
    assert!(
        result.is_err(),
        "the server accepted a bare server-local path as an audio source"
    );
}

#[tokio::test]
async fn sec_video_loopback_endpoint_is_refused() {
    let srv = LoopbackHttp::start("127.0.0.1:0", b64(GIF_B64), "image/gif").await;
    let result = parse_chat(chat_body(video_part(&srv.url("127.0.0.1", "one.gif")))).await;
    assert!(
        result.is_err(),
        "the server accepted a video source that points at its own loopback interface"
    );
    assert_eq!(srv.hits(), 0, "the server connected to the loopback endpoint");
}

#[tokio::test]
async fn sec_video_server_local_file_url_is_refused() {
    let path = fixture("secret.gif", &b64(GIF_B64));
    let url = format!("file://{}", path.display());
    let result = parse_chat(chat_body(video_part(&url))).await;
    assert!(
        result.is_err(),
        "the server accepted a file URL as a video source"
    );
}

#[tokio::test]
async fn sec_input_file_ipv6_loopback_is_refused() {
    let srv = LoopbackHttp::start("[::1]:0", b"attachment".to_vec(), "text/plain").await;
    let url = format!("http://[::1]:{}/note.txt", srv.port);
    let result = parse_responses(chat_body(file_part(
        serde_json::json!({"file_url": url}),
    )))
    .await;
    assert!(
        result.is_err(),
        "the server accepted an attachment source that names the IPv6 loopback literal"
    );
    assert_eq!(srv.hits(), 0, "the server connected to the loopback endpoint");
}

#[tokio::test]
async fn sec_input_file_loopback_hostname_is_refused() {
    let srv = LoopbackHttp::start("127.0.0.1:0", b"attachment".to_vec(), "text/plain").await;
    let url = srv.url(LOOPBACK_HOST, "note.txt");
    let result = parse_responses(chat_body(file_part(
        serde_json::json!({"file_url": url}),
    )))
    .await;
    assert!(
        result.is_err(),
        "the server accepted an attachment host name that resolves to its own loopback interface"
    );
    assert_eq!(srv.hits(), 0, "the server connected to the loopback endpoint");
}

#[tokio::test]
async fn sec_input_file_mapped_ipv6_loopback_is_refused() {
    let srv = LoopbackHttp::start("127.0.0.1:0", b"attachment".to_vec(), "text/plain").await;
    let url = format!("http://[::ffff:127.0.0.1]:{}/note.txt", srv.port);
    let result = parse_responses(chat_body(file_part(
        serde_json::json!({"file_url": url}),
    )))
    .await;
    assert!(
        result.is_err(),
        "the server accepted an IPv4-mapped IPv6 loopback address for an attachment"
    );
    assert_eq!(srv.hits(), 0, "the server connected to the loopback endpoint");
}

#[tokio::test]
async fn sec_input_file_local_path_is_refused() {
    let path = fixture("secret.txt", b"server-local attachment");
    let result = parse_responses(chat_body(file_part(serde_json::json!({
        "file_path": path.to_str().unwrap()
    }))))
    .await;
    assert!(
        result.is_err(),
        "the server accepted a bare server-local path as an attachment source"
    );
}

#[tokio::test]
async fn sec_input_file_local_path_chat_surface_is_refused() {
    let path = fixture("secret-chat.txt", b"server-local attachment");
    let result = parse_chat(chat_body(file_part(serde_json::json!({
        "file_path": path.to_str().unwrap()
    }))))
    .await;
    assert!(
        result.is_err(),
        "the server accepted a bare server-local path as an attachment source"
    );
}
