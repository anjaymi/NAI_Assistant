// NAI Assistant — Tauri 应用入口
// 此文件仅负责：模块声明、数据库初始化、Tauri Builder 编排
// 所有业务命令已拆分至 commands/ 子模块

mod airdrop_server;
mod commands;

use commands::tagger::TaggerState;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

// ── 数据库初始化 ─────────────────────────────────────────

fn setup_database(app: &AppHandle) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    let db_path = app_data_dir.join("data.db");

    if !db_path.exists() {
        println!("Database not found in app data, copying from resources...");
        
        std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;

        let resource_path = app
            .path()
            .resolve("resources/data.db", tauri::path::BaseDirectory::Resource)
            .map_err(|e| format!("Failed to resolve resource path: {}", e))?;

        println!("Resource path resolved to: {:?}", resource_path);

        // Try std::fs::copy first (works on desktop)
        match std::fs::copy(&resource_path, &db_path) {
            Ok(bytes) => {
                println!("Database copied successfully ({} bytes) to {:?}", bytes, db_path);
            }
            Err(copy_err) => {
                // On Android, resource files are inside APK assets and may not be
                // directly accessible via std::fs. Try read+write as fallback.
                println!("Direct copy failed ({}), trying read+write fallback...", copy_err);
                match std::fs::read(&resource_path) {
                    Ok(data) => {
                        std::fs::write(&db_path, &data)
                            .map_err(|e| format!("Failed to write database: {}", e))?;
                        println!("Database written successfully ({} bytes) to {:?}", data.len(), db_path);
                    }
                    Err(read_err) => {
                        // Final fallback: create empty database (tables will be created by ensureSchema)
                        println!("Read also failed ({}). Creating empty database.", read_err);
                        std::fs::write(&db_path, b"")
                            .map_err(|e| format!("Failed to create empty database: {}", e))?;
                    }
                }
            }
        }
    } else {
        let meta = std::fs::metadata(&db_path).ok();
        let size = meta.map(|m| m.len()).unwrap_or(0);
        println!("Database already exists at {:?} ({} bytes)", db_path, size);
    }
    Ok(())
}

// ── Tauri 应用主入口 ─────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Fix color profile issue on Windows (Prevent dark/washed out images)
    #[cfg(target_os = "windows")]
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--force-color-profile=srgb");

    let tagger_state = TaggerState(Arc::new(Mutex::new(None)));
    let tagger_state_clone = tagger_state.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        // TEMPORARILY DISABLED - testing if single_instance causes crash
        // .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
        //     // Safely try to focus the window (may not exist yet on first launch)
        //     if let Some(window) = app.get_webview_window("main") {
        //         let _ = window.set_focus();
        //     }
        //     if let Some(url) = args.iter().find(|arg| arg.starts_with("nais2://")) {
        //         let _ = app.emit("deep-link", url);
        //     }
        // }))
        .manage(tagger_state)
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Mac: Enable decorations for better performance
            // Windows: Disable decorations for custom titlebar
            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(true);
                }
            }

            // Start HTTP server for Photoshop plugin communication
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = commands::photoshop::start_ps_http_server(app_handle).await {
                    eprintln!("Failed to start PS HTTP server: {}", e);
                }
            });

            // Start locally-bound Airdrop server for Fast LAN straight-transfer
            let app_handle_airdrop = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = airdrop_server::start_airdrop_server(app_handle_airdrop).await {
                    eprintln!("Failed to start Airdrop LAN server: {}", e);
                }
            });

            // Initialize Database
            if let Err(e) = setup_database(app.handle()) {
                eprintln!("Failed to setup database: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::greet,
            commands::system::get_system_language,
            commands::system::open_in_explorer,
            commands::system::create_canvas_preview_image,
            commands::nai_api::verify_token,
            commands::nai_api::get_anlas_balance,
            commands::nai_api::generate_image_backend,
            commands::nai_api::prepare_img2img_input_backend,
            commands::nai_api::upscale_image,
            commands::nai_api::remove_background,
            commands::photoshop::open_embedded_browser,
            commands::photoshop::close_embedded_browser,
            commands::photoshop::navigate_embedded_browser,
            commands::photoshop::resize_embedded_browser,
            commands::photoshop::show_embedded_browser,
            commands::photoshop::hide_embedded_browser,
            commands::photoshop::is_browser_open,
            commands::photoshop::zoom_embedded_browser,
            commands::tagger::check_tagger_exists,
            commands::tagger::download_tagger,
            commands::tagger::get_tagger_download_url,
            commands::tagger::start_local_tagger,
            commands::photoshop::receive_ps_selection,
            commands::photoshop::inject_css,
            commands::system::move_window,
            commands::system::read_image_base64,
            commands::system::copy_image_to_clipboard,
            commands::tagger::download_model_file,
            commands::lan::get_local_ip,
            commands::lan::ping_lan,
            commands::lan::upload_to_lan,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill tagger process on exit
                if let Ok(mut child) = tagger_state_clone.0.lock() {
                    if let Some(child_process) = child.take() {
                        let _ = child_process.kill();
                    }
                }

                // Force kill tagger-server.exe as a safety net
                #[cfg(target_os = "windows")]
                {
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/IM", "tagger-server.exe"])
                        .output();
                }
            }
        });
}
