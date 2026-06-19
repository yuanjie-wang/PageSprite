mod ai;
mod cancel;
mod commands;
mod hooks;

use cancel::CancelManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    hooks::run_startup_hooks();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(CancelManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::project::save_project,
            commands::project::load_project,
            commands::settings::save_settings,
            commands::settings::load_settings,
            commands::agent::run_agent_generate,
            commands::agent::check_agent_installed,
            commands::agent::prepare_work_dir,
            commands::workspace::save_workspace,
            commands::workspace::load_workspace,
            commands::workspace::clear_temp_dir,
            cancel::cancel_generation,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, _event| {});
}
