//! Legitimate-use checks for OAuth protected-resource discovery and client
//! credentials. These must keep working for every valid deployment.

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

fn token_response() -> serde_json::Value {
    serde_json::json!({
        "access_token": "token-value",
        "token_type": "Bearer",
        "expires_in": 3600
    })
}

#[tokio::test]
async fn legitimate_canonical_discovery_still_works() {
    let stub = Stub::default();
    stub.challenge(
        BASE,
        "https://mcp.example.com/.well-known/oauth-protected-resource",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource",
        200,
        serde_json::json!({
            "resource": BASE,
            "authorization_servers": ["https://auth.example.com"]
        }),
    );
    stub.json(
        "https://auth.example.com/.well-known/oauth-authorization-server",
        200,
        as_metadata("https://auth.example.com/token"),
    );
    let manager = AuthorizationManager::new_with_oauth_http_client(BASE, Arc::new(stub))
        .await
        .unwrap();

    let metadata = manager.discover_metadata().await.unwrap();

    assert_eq!(metadata.token_endpoint, "https://auth.example.com/token");
}

#[tokio::test]
async fn bare_origin_identifiers_still_match_with_or_without_trailing_slash() {
    let stub = Stub::default();
    let origin = "https://mcp.example.com";
    stub.challenge(
        origin,
        "https://mcp.example.com/.well-known/oauth-protected-resource",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource",
        200,
        serde_json::json!({
            "resource": origin,
            "authorization_servers": ["https://auth.example.com"]
        }),
    );
    stub.json(
        "https://auth.example.com/.well-known/oauth-authorization-server",
        200,
        as_metadata("https://auth.example.com/token"),
    );
    let manager = AuthorizationManager::new_with_oauth_http_client(origin, Arc::new(stub))
        .await
        .unwrap();

    let metadata = manager.discover_metadata().await.unwrap();

    assert_eq!(metadata.token_endpoint, "https://auth.example.com/token");
}

#[tokio::test]
async fn path_inserted_well_known_metadata_still_works() {
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
            "authorization_servers": ["https://auth.example.com"]
        }),
    );
    stub.json(
        "https://auth.example.com/.well-known/oauth-authorization-server",
        200,
        as_metadata("https://auth.example.com/token"),
    );
    let manager = AuthorizationManager::new_with_oauth_http_client(BASE, Arc::new(stub))
        .await
        .unwrap();

    let metadata = manager.discover_metadata().await.unwrap();

    assert_eq!(metadata.token_endpoint, "https://auth.example.com/token");
}

#[tokio::test]
async fn client_credentials_with_server_resource_still_works() {
    let stub = Stub::default();
    stub.json(
        "https://mcp.example.com/.well-known/oauth-authorization-server/mcp",
        200,
        as_metadata("https://auth.example.com/token"),
    );
    stub.json("https://auth.example.com/token", 200, token_response());
    let mut state = OAuthState::new_with_oauth_http_client(BASE, Arc::new(stub.clone()))
        .await
        .unwrap();
    let config = ClientCredentialsConfig::ClientSecret {
        client_id: "client-id".to_string(),
        client_secret: "client-secret".to_string(),
        scopes: vec!["read".to_string()],
        resource: Some(BASE.to_string()),
    };

    state.authenticate_client_credentials(config).await.unwrap();

    let bodies = stub.posts_to("https://auth.example.com/token");
    assert_eq!(bodies.len(), 1, "requests: {:?}", stub.uris());
    let text = String::from_utf8_lossy(&bodies[0]).to_string();
    let params: Vec<(String, String)> = url::form_urlencoded::parse(text.as_bytes())
        .into_owned()
        .collect();
    assert!(
        params.iter().any(|(k, v)| k == "resource" && v == BASE),
        "token request must stay bound to the server: {text}"
    );
}

#[tokio::test]
async fn metadata_for_this_server_published_canonically_is_still_merged() {
    let stub = Stub::default();
    stub.challenge(
        BASE,
        "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
        200,
        serde_json::json!({ "resource": BASE }),
    );
    stub.json(
        "https://mcp.example.com/.well-known/oauth-protected-resource",
        200,
        serde_json::json!({
            "resource": BASE,
            "authorization_servers": ["https://auth.example.com"]
        }),
    );
    stub.json(
        "https://auth.example.com/.well-known/oauth-authorization-server",
        200,
        as_metadata("https://auth.example.com/token"),
    );
    let manager = AuthorizationManager::new_with_oauth_http_client(BASE, Arc::new(stub))
        .await
        .unwrap();

    let metadata = manager.discover_metadata().await.unwrap();

    assert_eq!(metadata.token_endpoint, "https://auth.example.com/token");
}
