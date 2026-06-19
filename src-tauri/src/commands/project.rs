use serde::{Deserialize, Serialize};
use std::fs;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnnotationData {
    pub id: String,
    pub r#type: String,
    pub points: Vec<Point>,
    pub bounding_box: Option<BoundingBox>,
    pub color: String,
    pub text: Option<String>,
    pub created_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageData {
    pub id: String,
    pub role: String,
    pub content: String,
    pub code: Option<String>,
    pub annotations: Option<Vec<AnnotationData>>,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectData {
    pub name: String,
    pub messages: Vec<MessageData>,
    pub annotations: Vec<AnnotationData>,
    pub generated_code: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProjectFile {
    name: String,
    messages: Vec<MessageData>,
    annotations: Vec<AnnotationData>,
    generated_code: String,
    created_at: u64,
    updated_at: u64,
}

#[tauri::command]
pub async fn save_project(app: AppHandle, data: ProjectData) -> Result<(), String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .add_filter("PageSprite", &["pagesprite.json"])
        .set_file_name(format!("{}.pagesprite.json", data.name))
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    let file_path = rx.await.map_err(|_| "Dialog closed unexpectedly".to_string())?
        .ok_or("Save cancelled")?;

    let project_file = ProjectFile {
        name: data.name,
        messages: data.messages,
        annotations: data.annotations,
        generated_code: data.generated_code,
        created_at: data.created_at,
        updated_at: data.updated_at,
    };

    let json = serde_json::to_string_pretty(&project_file)
        .map_err(|e| format!("Serialize error: {}", e))?;

    fs::write(file_path.to_string(), json)
        .map_err(|e| format!("Write error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn load_project(app: AppHandle) -> Result<ProjectData, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .add_filter("PageSprite", &["pagesprite.json"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    let file_path = rx.await.map_err(|_| "Dialog closed unexpectedly".to_string())?
        .ok_or("Open cancelled")?;

    let json = fs::read_to_string(file_path.to_string())
        .map_err(|e| format!("Read error: {}", e))?;

    let project_file: ProjectFile = serde_json::from_str(&json)
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(ProjectData {
        name: project_file.name,
        messages: project_file.messages,
        annotations: project_file.annotations,
        generated_code: project_file.generated_code,
        created_at: project_file.created_at,
        updated_at: project_file.updated_at,
    })
}
