use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub endpoint: String,
    pub api_key: String,
    pub model: String,
    pub system_prompt: String,
    #[serde(default)]
    pub agent_type: String,
    #[serde(default)]
    pub agent_command: Option<String>,
    #[serde(default)]
    pub agent_args_template: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            endpoint: "https://api.openai.com/v1".to_string(),
            api_key: String::new(),
            model: "gpt-4o".to_string(),
            system_prompt: DEFAULT_SYSTEM_PROMPT.to_string(),
            agent_type: "streaming".to_string(),
            agent_command: None,
            agent_args_template: None,
        }
    }
}

const DEFAULT_SYSTEM_PROMPT: &str = "You are a frontend page generator. Generate complete, standalone HTML files with embedded CSS and JavaScript.

Requirements:
- Output a single HTML file with inline <style> and <script> tags
- Use modern CSS (flexbox, grid, custom properties)
- Make designs responsive and visually polished
- Use CSS transitions/animations sparingly for polish
- Do NOT use external CDN links (except for icon libraries if essential)
- Wrap the output in a markdown code block with ```html

When the user provides annotations, they describe specific areas of the rendered page that need changes. Pay close attention to the annotation positions and text.";

fn settings_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot find home directory")?;
    let dir = home.join(".pagesprite");
    fs::create_dir_all(&dir).map_err(|e| format!("Create dir error: {}", e))?;
    Ok(dir.join("settings.json"))
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = settings_path()?;

    // Read existing file to preserve extra fields (e.g. hooks) not managed by the frontend
    let mut merged = read_raw(&path).unwrap_or_else(|| json!({}));

    // Merge frontend fields into existing JSON
    if let Some(obj) = merged.as_object_mut() {
        obj.insert("endpoint".into(), json!(settings.endpoint));
        obj.insert("api_key".into(), json!(settings.api_key));
        obj.insert("model".into(), json!(settings.model));
        obj.insert("system_prompt".into(), json!(settings.system_prompt));
        obj.insert("agent_type".into(), json!(settings.agent_type));
        if let Some(ref v) = settings.agent_command { obj.insert("agent_command".into(), json!(v)); } else { obj.remove("agent_command"); }
        if let Some(ref v) = settings.agent_args_template { obj.insert("agent_args_template".into(), json!(v)); } else { obj.remove("agent_args_template"); }
    }

    let json = serde_json::to_string_pretty(&merged)
        .map_err(|e| format!("Serialize error: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn load_settings() -> Result<AppSettings, String> {
    let path = match settings_path() {
        Ok(p) => p,
        Err(_) => return Ok(AppSettings::default()),
    };

    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let json = fs::read_to_string(&path).map_err(|e| format!("Read error: {}", e))?;
    serde_json::from_str(&json).map_err(|e| format!("Parse error: {}", e))
}

fn read_raw(path: &PathBuf) -> Option<Value> {
    fs::read_to_string(path).ok().and_then(|s| serde_json::from_str(&s).ok())
}
