use std::path::PathBuf;

/// 执行所有 trigger 对应的脚本。
/// 配置格式（在 settings.json 中）：
/// ```json
/// { "hooks": { "startup": ["./hooks/fetch-key.sh"] } }
/// ```
/// 脚本 stdout 按行解析 `KEY=VALUE` 并写入环境变量。
pub fn run_hooks(trigger: &str) {
    let base = match pagesprite_dir() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[hooks] {e}");
            return;
        }
    };

    let scripts = match load_scripts(trigger, &base) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[hooks] {e}");
            return;
        }
    };

    for script_rel in &scripts {
        let script_path = base.join(script_rel);
        if !script_path.exists() {
            eprintln!("[hooks] script not found: {}", script_path.display());
            continue;
        }

        eprintln!("[hooks] running: {}", script_rel);
        match exec_script(&script_path) {
            Ok(lines) => {
                for (key, val) in &lines {
                    std::env::set_var(key, val);
                    eprintln!("[hooks]   ${} = {} chars", key, val.len());
                }
                if lines.is_empty() {
                    eprintln!("[hooks]   (no output)");
                }
            }
            Err(e) => {
                eprintln!("[hooks] {script_rel} failed: {e}");
            }
        }
    }
}

/// 兼容旧的 run_startup_hooks 调用方式
pub fn run_startup_hooks() {
    run_hooks("startup");
}

/// 从 settings.json 读取 hooks 配置，返回指定 trigger 的脚本路径列表。
fn load_scripts(trigger: &str, base: &PathBuf) -> Result<Vec<String>, String> {
    let path = base.join("settings.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("cannot read {}: {e}", path.display()))?;
    let raw: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("parse error: {e}"))?;

    let Some(arr) = raw
        .get("hooks")
        .and_then(|v| v.get(trigger))
        .and_then(|v| v.as_array())
    else {
        return Ok(Vec::new());
    };

    let scripts: Vec<String> = arr
        .iter()
        .filter_map(|v| v.as_str().map(String::from))
        .collect();
    Ok(scripts)
}

/// 执行脚本，解析 stdout 中的 KEY=VALUE 行。
fn exec_script(script_path: &PathBuf) -> Result<Vec<(String, String)>, String> {
    let ext = script_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();

    let (program, args): (&str, Vec<&str>) = if cfg!(target_os = "windows") {
        match ext.as_str() {
            "bat" | "cmd" => ("cmd", vec!["/c", script_path.to_str().unwrap()]),
            "js" => ("node", vec![script_path.to_str().unwrap()]),
            "py" => ("python", vec![script_path.to_str().unwrap()]),
            "ps1" => ("powershell", vec!["-ExecutionPolicy", "Bypass", "-File", script_path.to_str().unwrap()]),
            _ => return Err(format!("unsupported script type on Windows: .{ext}")),
        }
    } else {
        match ext.as_str() {
            "sh" => ("sh", vec![script_path.to_str().unwrap()]),
            "js" => ("node", vec![script_path.to_str().unwrap()]),
            "py" => ("python3", vec![script_path.to_str().unwrap()]),
            _ => return Err(format!("unsupported script type: .{ext}")),
        }
    };

    let output = std::process::Command::new(program)
        .args(&args)
        .output()
        .map_err(|e| format!("cannot spawn: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "exit {:?}: {}",
            output.status.code(),
            stderr.trim()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut result = Vec::new();
    for line in stdout.lines() {
        let line = line.trim();
        if let Some(eq_pos) = line.find('=') {
            let key = line[..eq_pos].trim().to_string();
            let val = line[eq_pos + 1..].trim().to_string();
            if !key.is_empty() {
                result.push((key, val));
            }
        }
    }
    Ok(result)
}

fn pagesprite_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot find home directory")?;
    Ok(home.join(".pagesprite"))
}
