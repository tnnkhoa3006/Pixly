use tauri::AppHandle;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri::Manager;

#[tauri::command]
fn complete_splash(_app: AppHandle) {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Some(main_window) = _app.get_webview_window("main") {
            let _ = main_window.show();
            let _ = main_window.set_focus();
        }

        if let Some(splash_window) = _app.get_webview_window("splash") {
            let _ = splash_window.close();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .invoke_handler(tauri::generate_handler![complete_splash])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
