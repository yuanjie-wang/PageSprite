use serde::Deserialize;
use crate::ai::client::{self, ChatMessage, AiSettings};
use crate::cancel::CancelManager;
use std::path::PathBuf;
use std::fs;
use tokio::io::AsyncReadExt;

#[derive(Debug, Deserialize)]
pub struct AgentRunConfig {
    pub rect_id: String,
    pub prompt: String,
    pub existing_code: Option<String>,
    pub agent_type: String,
    // Custom agent fields
    pub command: Option<String>,
    pub args_template: Option<String>,
    pub history: Option<Vec<String>>,
}

fn work_dir(rect_id: &str) -> PathBuf {
    dirs::home_dir()
        .map(|h| h.join(".pagesprite").join("tmp").join(rect_id))
        .unwrap_or_else(|| std::env::temp_dir().join("pagesprite").join(rect_id))
}

/// Extract code from an AI response — tries ```html first, then any ``` block.
fn extract_code(text: &str) -> Option<String> {
    // Try ```html block first
    if let Some(start) = text.find("```html") {
        let after = &text[start + 7..];
        if let Some(end) = after.find("```") {
            return Some(after[..end].trim().to_string());
        }
    }
    // Try any code block
    if let Some(start) = text.find("```") {
        let after = &text[start + 3..];
        let body = if let Some(nl) = after.find('\n') {
            &after[nl + 1..]
        } else {
            after
        };
        if let Some(end) = body.find("```") {
            return Some(body[..end].trim().to_string());
        }
    }
    None
}


/// Interpolate `{dir}` and `{contextFile}` in a template string.
/// Does NOT replace `{prompt}` — the prompt is always appended as a
/// single separate argument to avoid whitespace splitting.
fn interpolate(template: &str, dir: &str, context_file: &str) -> String {
    template
        .replace("{dir}", dir)
        .replace("{contextFile}", context_file)
}

// ── Streaming agent (Rust-side AI API call) ──────────────────────────

async fn run_streaming_agent(
    config: &AgentRunConfig,
    settings: &AiSettings,
    cancel_mgr: &CancelManager,
) -> Result<String, String> {
    let dir = work_dir(&config.rect_id);
    fs::create_dir_all(&dir).map_err(|e| format!("create dir: {e}"))?;

    // Write existing code as context
    if let Some(code) = &config.existing_code {
        fs::write(dir.join("index.html"), code)
            .map_err(|e| format!("write context: {e}"))?;
    }

    // Build messages with revision history as previous user turns
    let mut messages: Vec<ChatMessage> = Vec::new();
    if let Some(history) = &config.history {
        for prompt in history {
            messages.push(ChatMessage {
                role: "user".to_string(),
                content: prompt.clone(),
            });
        }
    }
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: config.prompt.clone(),
    });

    let cancel_rx = cancel_mgr.register(config.rect_id.clone());
    let response = client::chat_stream(settings, &messages, |_| {}, Some(cancel_rx)).await?;
    cancel_mgr.unregister(&config.rect_id);

    let code = extract_code(&response)
        .ok_or_else(|| "AI response did not contain a code block".to_string())?;

    // Write result so the tmp dir always has the output file (useful for debugging)
    fs::write(dir.join("index.html"), &code)
        .map_err(|e| format!("write result: {e}"))?;

    Ok(code)
}

// ── CLI-based agent (OpenCode, Claude Code, Custom) ─────────────────

/// Pre-create the work directory and index.html for a rect.
/// The agent is guided to modify this file rather than create new ones.
#[tauri::command]
pub async fn prepare_work_dir(rect_id: String, existing_code: Option<String>) -> Result<(), String> {
    let dir = work_dir(&rect_id);
    fs::create_dir_all(&dir).map_err(|e| format!("create dir: {e}"))?;
    let path = dir.join("index.html");
    if !path.exists() {
        fs::write(&path, existing_code.unwrap_or_default())
            .map_err(|e| format!("write index.html: {e}"))?;
    }
    Ok(())
}

async fn run_cli_agent(
    config: &AgentRunConfig,
    cancel_mgr: &CancelManager,
) -> Result<String, String> {
    let dir = work_dir(&config.rect_id);
    fs::create_dir_all(&dir).map_err(|e| format!("create dir: {e}"))?;

    let context_path = dir.join("index.html");

    // Always write index.html (existing code or empty) so the CLI agent
    // finds the file already there and modifies it instead of creating a new one.
    fs::write(&context_path, config.existing_code.as_deref().unwrap_or_default())
        .map_err(|e| format!("write context: {e}"))?;

    let dir_str = dir.to_string_lossy().to_string();
    let context_str = context_path.to_string_lossy().to_string();

    // Resolve command and arguments
    let command = config.command.as_deref().unwrap_or("opencode");
    let template = config.args_template.as_deref().unwrap_or("");
    let raw_args = interpolate(template, &dir_str, &context_str);

    // Build args from the template (whitespace-split for flags only),
    // then append the prompt as a single argument so multi-word prompts aren't broken.
    let mut args: Vec<&str> = raw_args.split_whitespace().collect();
    if !config.prompt.is_empty() {
        args.push(&config.prompt);
    }

    eprintln!("[agent] running: {command} {}", args.join(" "));
    eprintln!("[agent] cwd: {dir_str}");

    let mut child = tokio::process::Command::new(command)
        .args(&args)
        .current_dir(&dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("cannot spawn {command}: {e}"))?;

    let mut stdout_pipe = child.stdout.take();
    let mut stderr_pipe = child.stderr.take();

    /// Read bytes from a pipe into a string.
    async fn read_pipe_str<T: tokio::io::AsyncRead + Unpin>(pipe: &mut Option<T>) -> Option<String> {
        let mut buf = String::new();
        pipe.as_mut()?.read_to_string(&mut buf).await.ok()?;
        let trimmed = buf.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    }

    /// Helper to format a failure message with exit code + captured output.
    fn fail_msg(command: &str, status: std::process::ExitStatus, stdout: Option<String>, stderr: Option<String>) -> String {
        let code = status.code().map(|c| c.to_string()).unwrap_or_else(|| "unknown".into());
        let mut msg = format!("{command} exited with status {code}");
        if let Some(out) = &stdout { msg.push_str(&format!("\nstdout:\n{out}")); }
        if let Some(err) = &stderr { msg.push_str(&format!("\nstderr:\n{err}")); }
        msg
    }

    // Race with cancellation
    let mut cancel_rx = cancel_mgr.register(config.rect_id.clone());

    let status = tokio::select! {
        status = child.wait() => {
            cancel_mgr.unregister(&config.rect_id);
            status.map_err(|e| format!("{command} error: {e}"))?
        }
        _ = cancel_rx.changed() => {
            child.kill().await.ok();
            child.wait().await.ok();
            return Err("cancelled".into());
        }
    };

    if !status.success() {
        let stderr = read_pipe_str(&mut stderr_pipe).await;
        let stdout = read_pipe_str(&mut stdout_pipe).await;
        return Err(fail_msg(command, status, stdout, stderr));
    }

    // Always read index.html — the agent was guided to modify this file.
    let content = fs::read_to_string(&context_path)
        .map_err(|e| format!("cannot read index.html: {e}"))?;
    Ok(extract_code(&content).unwrap_or(content))
}

// ── Public command ──────────────────────────────────────────────────

#[tauri::command]
pub async fn run_agent_generate(
    config: AgentRunConfig,
    settings: AiSettings,
    cancel_mgr: tauri::State<'_, CancelManager>,
) -> Result<String, String> {
    match config.agent_type.as_str() {
        "streaming" => run_streaming_agent(&config, &settings, &cancel_mgr).await,
        "custom" => run_cli_agent(&config, &cancel_mgr).await,
        agent_type => {
            // For named agents (opencode, claude, etc.) — always use defaults,
            // ignore any custom command/template the frontend may have sent.
            let defaults = builtin_agent_config(agent_type)?;
            let merged = AgentRunConfig {
                command: defaults.command,
                args_template: defaults.args_template,
                ..config
            };
            run_cli_agent(&merged, &cancel_mgr).await
        }
    }
}

/// Detect if a CLI binary is available on PATH.
#[tauri::command]
pub fn check_agent_installed(command: String) -> bool {
    which::which(&command).is_ok()
}

// ── Built-in agent configs ──────────────────────────────────────────

struct AgentDefaults {
    command: Option<String>,
    args_template: Option<String>,
}

fn builtin_agent_config(agent_type: &str) -> Result<AgentDefaults, String> {
    match agent_type {
        "opencode" => Ok(AgentDefaults {
            command: Some("opencode".into()),
            args_template: Some(r#"run --dir {dir} --format json"#.into()),
        }),
        "claude" => Ok(AgentDefaults {
            command: Some("claude".into()),
            args_template: Some("-p".into()),
        }),
        other => Err(format!("unknown built-in agent type: {other}")),
    }
}
