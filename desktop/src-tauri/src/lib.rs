mod commands;

#[cfg(desktop)]
use tauri::Manager;

#[cfg(desktop)]
fn activate_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        activate_main_window(app);
    }));

    #[cfg(target_os = "android")]
    let builder = builder.plugin(commands::user_credentials::android_plugin());

    builder
        .plugin(
            tauri_plugin_log::Builder::new()
                .max_file_size(2_000_000)
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::external_url::open_external_url,
            commands::user_credentials::save_user_token,
            commands::user_credentials::load_user_token,
            commands::user_credentials::delete_user_token,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Personal Blog");
}
