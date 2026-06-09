use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use std::env;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tower_http::cors::{Any, CorsLayer};

#[derive(Clone)]
pub struct AirdropState {
    pub app_handle: AppHandle,
}

pub async fn start_airdrop_server(
    app_handle: AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let state = AirdropState { app_handle };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(|| async { "NAI Assistant Airdrop Server is running!" }))
        .route("/api/airdrop/ping", get(handle_ping))
        .route("/api/airdrop/upload", post(handle_upload))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:38080").await?;
    println!("[Airdrop LAN Server] Listening on http://0.0.0.0:38080");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn handle_ping(State(state): State<AirdropState>) -> &'static str {
    // Notify the frontend that a Mobile device on the LAN actively anchored to us
    let _ = state.app_handle.emit("lan_ping_received", ());
    "pong"
}

async fn handle_upload(
    State(state): State<AirdropState>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let mut file_path_opt: Option<PathBuf> = None;
    let mut saved_filename_opt: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e: axum::extract::multipart::MultipartError| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name == "fileToUpload" || name == "file" {
            let original_filename = field
                .file_name()
                .unwrap_or("airdrop_image.png")
                .to_string();

            let data = field
                .bytes()
                .await
                .map_err(|e: axum::extract::multipart::MultipartError| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            // Save to OS Temp Dir
            let mut temp_path = env::temp_dir();
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis();
            let safe_filename = format!("airdrop_{}_{}", ts, original_filename);
            temp_path.push(&safe_filename);

            // Blockingly write file (or use tokio fs in future if performance demands, but memory to disk is fast enough here)
            let mut file = File::create(&temp_path)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create temp file: {}", e)))?;
            file.write_all(&data)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write temp file: {}", e)))?;

            file_path_opt = Some(temp_path);
            saved_filename_opt = Some(safe_filename);
            break; // Assuming only one file per request
        }
    }

    if let (Some(path), Some(filename)) = (file_path_opt, saved_filename_opt) {
        // Emit event to frontend with the absolute path string
        #[derive(serde::Serialize, Clone)]
        struct AirdropPayload {
            temp_path: String,
            filename: String,
        }

        let payload = AirdropPayload {
            temp_path: path.to_string_lossy().to_string(),
            filename,
        };

        if let Err(e) = state.app_handle.emit("lan_airdrop_received", &payload) {
            eprintln!("[Airdrop Server] Failed to emit event: {}", e);
            return Err((StatusCode::INTERNAL_SERVER_ERROR, "Event emit failed".to_string()));
        }

        Ok(Json(serde_json::json!({
            "success": true,
            "message": "File received and saved to temp directory"
        })))
    } else {
        Err((StatusCode::BAD_REQUEST, "No file found in payload".to_string()))
    }
}
