mod commands;

use tauri::Manager;

fn activate_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Keep single-instance first so later plugins cannot run twice during startup.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            activate_main_window(app);
        }))
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::credentials::credential_get,
            commands::credentials::credential_set,
            commands::credentials::credential_delete,
            commands::external_url::open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Personal Website Studio");
}
