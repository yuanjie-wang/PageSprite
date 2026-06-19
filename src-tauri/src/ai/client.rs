use std::sync::OnceLock;
use std::time::Duration;
use serde::{Deserialize, Serialize};
use tokio::sync::watch;

/// Resolve `{env:VAR_NAME}` syntax in API keys.
/// If the input matches `{env:...}`, reads the named environment variable.
/// Otherwise returns the input unchanged.
pub fn resolve_api_key(key: &str) -> String {
    if let Some(var_name) = key.strip_prefix("{env:").and_then(|s| s.strip_suffix("}")) {
        std::env::var(var_name).unwrap_or_else(|_| {
            eprintln!("[warn] env var {var_name} not set, using raw key");
            key.to_string()
        })
    } else {
        key.to_string()
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatRequestMessage>,
    stream: bool,
}

#[derive(Debug, Serialize)]
struct ChatRequestMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatChunk {
    #[allow(dead_code)]
    id: Option<String>,
    #[allow(dead_code)]
    object: Option<String>,
    choices: Vec<ChunkChoice>,
}

#[derive(Debug, Deserialize)]
struct ChunkChoice {
    delta: Delta,
    #[allow(dead_code)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Delta {
    content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiSettings {
    pub endpoint: String,
    pub api_key: String,
    pub model: String,
    pub system_prompt: Option<String>,
}

/// Convert frontend messages + optional system prompt to API format
fn build_request_messages(
    messages: &[ChatMessage],
    settings: &AiSettings,
) -> Vec<ChatRequestMessage> {
    let mut result = Vec::new();

    if let Some(ref sp) = settings.system_prompt {
        if !sp.is_empty() {
            result.push(ChatRequestMessage {
                role: "system".to_string(),
                content: sp.clone(),
            });
        }
    }

    for msg in messages {
        result.push(ChatRequestMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
        });
    }

    result
}

/// Shared HTTP client with connection pooling (reused across all requests).
fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("failed to create reqwest Client")
    })
}

/// Send a streaming chat completion request to an OpenAI-compatible API.
/// Calls `on_chunk` for each content delta, and returns the full accumulated text.
/// If `cancel_rx` receives `true`, the stream is aborted early.
pub async fn chat_stream(
    settings: &AiSettings,
    messages: &[ChatMessage],
    on_chunk: impl Fn(String),
    mut cancel_rx: Option<watch::Receiver<bool>>,
) -> Result<String, String> {
    let url = format!("{}/chat/completions", settings.endpoint.trim_end_matches('/'));

    let api_messages = build_request_messages(messages, settings);

    let request_body = ChatRequest {
        model: settings.model.clone(),
        messages: api_messages,
        stream: true,
    };

    let client = http_client();

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", resolve_api_key(&settings.api_key)))
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API error ({}): {}", status, body));
    }

    let mut full_content = String::new();

    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    let mut buf = String::new();

    loop {
        // Race stream chunk vs cancellation signal
        let chunk_result = if let Some(ref mut rx) = cancel_rx {
            tokio::select! {
                biased;
                _ = rx.changed() => {
                    if *rx.borrow() {
                        return Err("cancelled".into());
                    }
                    continue;
                }
                result = stream.next() => result,
            }
        } else {
            stream.next().await
        };

        let Some(chunk_result) = chunk_result else { break };
        let chunk = chunk_result.map_err(|e| format!("Stream read error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        buf.push_str(&text);

        // Process complete SSE lines
        while let Some(newline_pos) = buf.find('\n') {
            let line = buf[..newline_pos].trim().to_string();
            buf = buf[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if !line.starts_with("data: ") {
                continue;
            }

            let data = &line[6..]; // strip "data: "

            if data == "[DONE]" {
                break;
            }

            if let Ok(chunk) = serde_json::from_str::<ChatChunk>(data) {
                if let Some(content) = chunk.choices.first().and_then(|c| c.delta.content.clone()) {
                    full_content.push_str(&content);
                    on_chunk(content);
                }
            }
        }
    }

    Ok(full_content)
}
