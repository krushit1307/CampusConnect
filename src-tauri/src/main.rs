// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{CustomMenuItem, SystemTray, SystemTrayMenu, SystemTrayEvent, Manager};
use tauri::api::notification::Notification;

#[tauri::command]
fn trigger_native_notification(title: String, body: String) {
    Notification::new("com.campusconnect.app")
        .title(title)
        .body(body)
        .show()
        .unwrap_or_default();
}

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide");
    let tray_menu = SystemTrayMenu::new()
        .add_item(hide)
        .add_item(quit);
    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => {
                match id.as_str() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "hide" => {
                        let window = app.get_window("main").unwrap();
                        window.hide().unwrap();
                    }
                    _ => {}
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![trigger_native_notification])
        .setup(|app| {
            // Register global shortcut Cmd+Shift+E / Ctrl+Shift+E
            #[cfg(desktop)]
            {
                use tauri::GlobalShortcutManager;
                let mut shortcut = app.global_shortcut_manager();
                let window = app.get_window("main").unwrap();
                let _ = shortcut.register("CmdOrCtrl+Shift+E", move || {
                    let _ = window.emit("shortcut-create-event", {});
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
