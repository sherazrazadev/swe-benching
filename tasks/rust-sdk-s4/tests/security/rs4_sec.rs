//! Behavioural checks for the protected-resource identity binding of the OAuth
//! client. Every test drives the public OAuth entry points against an in-process
//! HTTP stub; no network is used.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use rmcp::transport::auth::{
    AuthorizationManager, ClientCredentialsConfig, OAuthHttpClient, OAuthHttpClientError,
    OAuthHttpClientFuture, OAuthHttpRequest, OAuthState,
};

const BASE: &str = "https://mcp.example.com/mcp";

#[derive(Clone)]
struct Route {
    status: u16,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

#[derive(Clone, Default)]
struct Stub {
    routes: Arc<Mutex<HashMap<String, Route>>>,
    requests: Arc<Mutex<Vec<(String, String, Vec<u8>)>>>,
}

impl Stub {
    fn json(&self, uri: &str, status: u16, body: serde_json::Value) {
        self.raw(uri, status, &[("content-type", "application/json")], serde_json::to_vec(&body).unwrap());
    }
    fn challenge(&self, uri: &str, resource_metadata: &str) {
        let header = format!("Bearer resource_metadata=\"{resource_metadata}\"");
        self.raw(uri, 401, &[("www-authenticate", header.as_str())], Vec::new());
    }
    fn raw(&self, uri: &str, status: u16, headers: &[(&str, &str)], body: Vec<u8>) {
        self.routes.lock().unwrap().insert(
            uri.to_string(),
            Route {
                status,
                headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
                body,
            },
        );
    }
    fn uris(&self) -> Vec<String> {
        self.requests.lock().unwrap().iter().map(|r| r.1.clone()).collect()
    }
    fn posts_to(&self, uri: &str) -> Vec<Vec<u8>> {
        self.requests
            .lock()
            .unwrap()
            .iter()
            .filter(|r| r.0 == "POST" && r.1 == uri)
            .map(|r| r.2.clone())
            .collect()
    }
    fn hit(&self, prefix: &str) -> bool {
        self.uris().iter().any(|u| u.starts_with(prefix))
    }
}

impl OAuthHttpClient for Stub {
    fn execute(&self, request: OAuthHttpRequest) -> OAuthHttpClientFuture<'_> {
        let method = request.request.method().to_string();
        let uri = request.request.uri().to_string();
        let body = request.request.body().clone();
        self.requests.lock().unwrap().push((method, uri.clone(), body));
        let route = self.routes.lock().unwrap().get(&uri).cloned();
        Box::pin(async move {
            match route {
                Some(r) => {
                    let mut builder = oauth2::http::Response::builder().status(r.status);
                    for (k, v) in r.headers {
                        builder = builder.header(k, v);
                    }
                    Ok(builder
                        .body(r.body)
                        .map_err(|e| OAuthHttpClientError::new(e.to_string()))?)
                }
                None => Ok(oauth2::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap()),
            }
        })
    }
}

fn as_metadata(token_endpoint: &str) -> serde_json::Value {
    serde_json::json!({
        "issuer": "https://auth.example.com",
        "authorization_endpoint": "https://auth.example.com/authorize",
        "token_endpoint": token_endpoint,
        "token_endpoint_auth_methods_supported": ["client_secret_post"],
        "grant_types_supported": ["client_credentials"],
        "scopes_supported": ["read"]
    })
}

fn evil_metadata() -> serde_json::Value {
    serde_json::json!({
        "authorization_endpoint": "https://evil.example.com/authorize",
        "token_endpoint": "https://evil.example.com/token"
    })
}

async fn manager_with(stub: Stub) -> AuthorizationManager {
    AuthorizationManager::new_with_oauth_http_client(BASE, Arc::new(stub))
        .await
        .unwrap()
}

/// A document that names another host must not steer discovery to the
/// authorization server it advertises.
#[tokio::test]
async fn resource_metadata_for_another_host_is_refused() {
    let stub = Stub::default();
    stub.challenge(
        BASE,
        "https://mcp.example.com/.well-known/oauth-protected-resource",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource",
        200,
        serde_json::json!({
            "resource": "https://real.example.com/mcp",
            "authorization_servers": ["https://evil.example.com"]
        }),
    );
    stub.json(
        "https://evil.example.com/.well-known/oauth-authorization-server",
        200,
        evil_metadata(),
    );
    let manager = manager_with(stub.clone()).await;

    let result = manager.discover_metadata().await;

    assert!(result.is_err(), "discovery must refuse the document: {result:?}");
    assert!(!stub.hit("https://evil.example.com"), "requests: {:?}", stub.uris());
}

/// A document with no resource identifier must not be acted on.
#[tokio::test]
async fn resource_metadata_without_resource_is_refused() {
    let stub = Stub::default();
    stub.challenge(
        BASE,
        "https://mcp.example.com/.well-known/oauth-protected-resource",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource",
        200,
        serde_json::json!({ "authorization_servers": ["https://evil.example.com"] }),
    );
    stub.json(
        "https://evil.example.com/.well-known/oauth-authorization-server",
        200,
        evil_metadata(),
    );
    let manager = manager_with(stub.clone()).await;

    let result = manager.discover_metadata().await;

    assert!(result.is_err(), "discovery must refuse the document: {result:?}");
    assert!(!stub.hit("https://evil.example.com"), "requests: {:?}", stub.uris());
}

/// A trailing slash on a path identifier names a different resource.
#[tokio::test]
async fn resource_metadata_with_path_trailing_slash_is_refused() {
    let stub = Stub::default();
    stub.challenge(
        BASE,
        "https://mcp.example.com/.well-known/oauth-protected-resource",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource",
        200,
        serde_json::json!({
            "resource": "https://mcp.example.com/mcp/",
            "authorization_servers": ["https://evil.example.com"]
        }),
    );
    stub.json(
        "https://evil.example.com/.well-known/oauth-authorization-server",
        200,
        evil_metadata(),
    );
    let manager = manager_with(stub.clone()).await;

    let result = manager.discover_metadata().await;

    assert!(result.is_err(), "discovery must refuse the document: {result:?}");
    assert!(!stub.hit("https://evil.example.com"), "requests: {:?}", stub.uris());
}

/// A different path on the same host names a different resource.
#[tokio::test]
async fn resource_metadata_for_another_path_is_refused() {
    let stub = Stub::default();
    stub.challenge(
        BASE,
        "https://mcp.example.com/.well-known/oauth-protected-resource",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource",
        200,
        serde_json::json!({
            "resource": "https://mcp.example.com/other",
            "authorization_servers": ["https://evil.example.com"]
        }),
    );
    stub.json(
        "https://evil.example.com/.well-known/oauth-authorization-server",
        200,
        evil_metadata(),
    );
    let manager = manager_with(stub.clone()).await;

    let result = manager.discover_metadata().await;

    assert!(result.is_err(), "discovery must refuse the document: {result:?}");
    assert!(!stub.hit("https://evil.example.com"), "requests: {:?}", stub.uris());
}

/// The document's own URL is not the resource it may claim to describe.
#[tokio::test]
async fn resource_metadata_claiming_the_document_url_is_refused() {
    let stub = Stub::default();
    stub.challenge(
        BASE,
        "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
        200,
        serde_json::json!({
            "resource": "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
            "authorization_servers": ["https://evil.example.com"]
        }),
    );
    stub.json(
        "https://evil.example.com/.well-known/oauth-authorization-server",
        200,
        evil_metadata(),
    );
    let manager = manager_with(stub.clone()).await;

    let result = manager.discover_metadata().await;

    assert!(result.is_err(), "discovery must refuse the document: {result:?}");
    assert!(!stub.hit("https://evil.example.com"), "requests: {:?}", stub.uris());
}

/// Data from a rejected document must not survive into later OAuth requests.
#[tokio::test]
async fn rejected_resource_metadata_must_not_change_requested_scopes() {
    let stub = Stub::default();
    stub.challenge(
        BASE,
        "https://mcp.example.com/.well-known/oauth-protected-resource",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource",
        200,
        serde_json::json!({
            "resource": "https://real.example.com/mcp",
            "authorization_servers": ["https://evil.example.com"],
            "scopes_supported": ["admin", "offline_access"]
        }),
    );
    let manager = manager_with(stub.clone()).await;

    let result = manager.discover_metadata().await;

    assert!(result.is_err(), "discovery must refuse the document: {result:?}");
    let scopes = manager.select_scopes(None, &[]);
    assert!(
        !scopes.iter().any(|scope| scope == "admin"),
        "rejected document leaked scopes into later requests: {scopes:?}"
    );
}

/// Every token request must be bound to this server, whatever resource the
/// caller configured.
#[tokio::test]
async fn client_credentials_must_bind_resource_to_server() {
    let stub = Stub::default();
    stub.json(
        "https://mcp.example.com/.well-known/oauth-authorization-server/mcp",
        200,
        as_metadata("https://auth.example.com/token"),
    );
    stub.json(
        "https://auth.example.com/token",
        200,
        serde_json::json!({
            "access_token": "token-value",
            "token_type": "Bearer",
            "expires_in": 3600
        }),
    );
    let mut state = OAuthState::new_with_oauth_http_client(BASE, Arc::new(stub.clone()))
        .await
        .unwrap();
    let config = ClientCredentialsConfig::ClientSecret {
        client_id: "client-id".to_string(),
        client_secret: "client-secret".to_string(),
        scopes: vec!["read".to_string()],
        resource: Some("https://other.example.com/mcp".to_string()),
    };

    let _ = state.authenticate_client_credentials(config).await;

    for body in stub.posts_to("https://auth.example.com/token") {
        let text = String::from_utf8_lossy(&body).to_string();
        let params: Vec<(String, String)> = url::form_urlencoded::parse(text.as_bytes())
            .into_owned()
            .collect();
        for (key, value) in params {
            if key == "resource" {
                assert_eq!(
                    value, BASE,
                    "a token request was bound to another resource: {value}"
                );
            }
        }
    }
    assert!(
        !stub.hit("https://other.example.com"),
        "requests: {:?}",
        stub.uris()
    );
}

/// Authorization servers advertised by a second document for another resource
/// must not enter discovery.
#[tokio::test]
async fn canonical_metadata_for_another_resource_is_not_used() {
    let stub = Stub::default();
    stub.challenge(
        BASE,
        "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
        200,
        serde_json::json!({
            "resource": BASE,
            "authorization_servers": ["https://legit.example.com"]
        }),
    );
    // The primary authorization server is not discoverable in this fixture.
    stub.raw(
        "https://legit.example.com/.well-known/oauth-authorization-server",
        404,
        &[],
        Vec::new(),
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource",
        200,
        serde_json::json!({
            "resource": "https://other.example.com/mcp",
            "authorization_servers": ["https://evil.example.com"]
        }),
    );
    stub.json(
        "https://evil.example.com/.well-known/oauth-authorization-server",
        200,
        evil_metadata(),
    );
    let manager = manager_with(stub.clone()).await;

    let result = manager.discover_metadata().await;

    assert!(result.is_err(), "discovery must refuse: {result:?}");
    assert!(!stub.hit("https://evil.example.com"), "requests: {:?}", stub.uris());
}
