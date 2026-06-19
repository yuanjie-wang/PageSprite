use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedBoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedAnnotation {
    pub id: String,
    pub r#type: String,
    pub points: Vec<PersistedPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounding_box: Option<PersistedBoundingBox>,
    pub color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_width: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_height: Option<String>,
    pub created_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PersistedMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceData {
    pub annotations: Vec<PersistedAnnotation>,
    pub messages: Vec<PersistedMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generated_code: Option<String>,
    pub updated_at: u64,
}

fn workspace_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot find home directory")?;
    let dir = home.join(".pagesprite");
    fs::create_dir_all(&dir).map_err(|e| format!("Create dir error: {}", e))?;
    Ok(dir.join("workspace.json"))
}

fn tmp_dir() -> PathBuf {
    dirs::home_dir()
        .map(|h| h.join(".pagesprite").join("tmp"))
        .unwrap_or_else(|| std::env::temp_dir().join("pagesprite"))
}

#[tauri::command]
pub fn save_workspace(data: WorkspaceData) -> Result<(), String> {
    let path = workspace_path()?;
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Serialize error: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn load_workspace() -> Result<Option<WorkspaceData>, String> {
    let path = match workspace_path() {
        Ok(p) => p,
        Err(_) => return Ok(None),
    };
    if !path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("Read error: {}", e))?;
    let data: WorkspaceData = serde_json::from_str(&json).map_err(|e| format!("Parse error: {}", e))?;
    Ok(Some(data))
}

#[tauri::command]
pub fn clear_temp_dir() -> Result<(), String> {
    let dir = tmp_dir();
    if !dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(&dir).map_err(|e| format!("Read tmp dir error: {}", e))? {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let path = entry.path();
        if path.is_dir() {
            fs::remove_dir_all(&path).ok();
        } else {
            fs::remove_file(&path).ok();
        }
    }
    Ok(())
}
