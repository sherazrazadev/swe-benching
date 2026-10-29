mod common;

use common::*;
use image::GenericImageView;

#[tokio::test]
async fn fun_local_image_bare_path_still_loads() {
    let path = fixture("usable.png", &b64(PNG_B64));
    let image = mistralrs_server_core::util::parse_image_url(path.to_str().unwrap())
        .await
        .expect("a trusted caller's local image path must keep working");
    assert_eq!(image.dimensions(), (1, 1));
}

#[tokio::test]
async fn fun_local_image_file_url_still_loads() {
    let path = fixture("usable-url.png", &b64(PNG_B64));
    let url = format!("file://{}", path.display());
    let image = mistralrs_server_core::util::parse_image_url(&url)
        .await
        .expect("a trusted caller's file URL must keep working");
    assert_eq!(image.dimensions(), (1, 1));
}

#[tokio::test]
async fn fun_local_audio_bare_path_still_loads() {
    let path = fixture("usable.wav", &b64(WAV_B64));
    let audio = mistralrs_server_core::util::parse_audio_url(path.to_str().unwrap())
        .await
        .expect("a trusted caller's local audio path must keep working");
    assert_eq!(audio.sample_rate, 8000);
}

#[tokio::test]
async fn fun_local_audio_data_url_still_loads() {
    let url = data_url("audio/wav", WAV_B64);
    let audio = mistralrs_server_core::util::parse_audio_url(&url)
        .await
        .expect("a data URL must keep working");
    assert_eq!(audio.sample_rate, 8000);
}

#[tokio::test]
async fn fun_local_video_bare_path_still_loads() {
    let path = fixture("usable.gif", &b64(GIF_B64));
    let video = mistralrs_server_core::video::parse_video_url(path.to_str().unwrap(), None)
        .await
        .expect("a trusted caller's local video path must keep working");
    assert!(!video.frames.is_empty());
}

#[tokio::test]
async fn fun_local_video_file_url_still_loads() {
    let path = fixture("usable-url.gif", &b64(GIF_B64));
    let url = format!("file://{}", path.display());
    let video = mistralrs_server_core::video::parse_video_url(&url, None)
        .await
        .expect("a trusted caller's video file URL must keep working");
    assert!(!video.frames.is_empty());
}

#[tokio::test]
async fn fun_server_image_data_url_still_loads() {
    parse_chat(chat_body(image_part(&data_url("image/png", PNG_B64))))
        .await
        .expect("an inline image must keep working on the server");
}

#[tokio::test]
async fn fun_server_audio_data_url_still_loads() {
    parse_chat(chat_body(audio_part(&data_url("audio/wav", WAV_B64))))
        .await
        .expect("inline audio must keep working on the server");
}

#[tokio::test]
async fn fun_server_video_data_url_still_loads() {
    parse_chat(chat_body(video_part(&data_url("image/gif", GIF_B64))))
        .await
        .expect("inline video must keep working on the server");
}

#[tokio::test]
async fn fun_server_file_data_still_loads() {
    let payload = "aGVsbG8="; // "hello"
    parse_responses(chat_body(file_part(serde_json::json!({
        "file_data": payload,
        "filename": "note.txt"
    }))))
    .await
    .expect("an inline attachment must keep working on the server");
}

#[tokio::test]
async fn fun_server_file_data_url_still_loads() {
    let payload = data_url("text/plain", "aGVsbG8=");
    parse_responses(chat_body(file_part(serde_json::json!({
        "file_data": payload,
        "filename": "note.txt"
    }))))
    .await
    .expect("an inline attachment data URL must keep working on the server");
}

#[tokio::test]
async fn fun_server_text_only_still_loads() {
    let body = serde_json::json!({
        "model": "default",
        "messages": [{"role": "user", "content": "hello"}]
    });
    parse_chat(body)
        .await
        .expect("a text-only request must keep working");
}
