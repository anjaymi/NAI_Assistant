// Photoshop 插件集成模块
// 包含：PS HTTP Server、PS 选区接收、嵌入浏览器控制、CSS 注入

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tower_http::cors::{Any, CorsLayer};

// ── 数据结构 ──────────────────────────────────────────────

/// Photoshop Selection Data
#[derive(Debug, Serialize, Deserialize)]
pub struct PSSelectionData {
    pub image: String, // Base64 data URL
    pub width: u32,
    pub height: u32,
    pub mode: String, // "simple" or "advanced"
    pub strength: f32,
    pub noise: f32,
    pub model: Option<String>,
    pub steps: Option<u32>,
    pub prompt: Option<String>,
    #[serde(rename = "negativePrompt")]
    pub negative_prompt: Option<String>,
}

// Store for tracking embedded webviews
struct EmbeddedWebviews {
    webviews: HashMap<String, bool>,
}

static EMBEDDED_WEBVIEWS: std::sync::LazyLock<Mutex<EmbeddedWebviews>> =
    std::sync::LazyLock::new(|| {
        Mutex::new(EmbeddedWebviews {
            webviews: HashMap::new(),
        })
    });

// 用于存储生成结果的全局状态
static PS_GENERATION_RESULT: std::sync::OnceLock<std::sync::Mutex<Option<String>>> =
    std::sync::OnceLock::new();

fn get_ps_result_store() -> &'static std::sync::Mutex<Option<String>> {
    PS_GENERATION_RESULT.get_or_init(|| std::sync::Mutex::new(None))
}

// ── PS Tauri 命令 ────────────────────────────────────────

/// 接收 Photoshop 选区并发射事件到前端
#[tauri::command]
pub async fn receive_ps_selection(
    app: AppHandle,
    data: PSSelectionData,
) -> Result<String, String> {
    println!(
        "[PS] Received selection: {}x{}, mode: {}",
        data.width, data.height, data.mode
    );

    // Emit event to frontend
    app.emit("ps-selection-received", &data)
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok("success".to_string())
}

// ── PS HTTP Server ───────────────────────────────────────

/// 启动 PS HTTP Server（127.0.0.1:8080）
pub async fn start_ps_http_server(
    app_handle: AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let app_state = std::sync::Arc::new(app_handle);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/health", get(health_check))
        .route("/api/ps/receive-selection", post(handle_ps_selection))
        .route("/api/ps/submit-result", post(submit_ps_result))
        .layer(cors)
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
    println!("[PS HTTP Server] Listening on http://127.0.0.1:8080");

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> &'static str {
    "ok"
}

async fn handle_ps_selection(
    State(app_handle): State<std::sync::Arc<AppHandle>>,
    Json(data): Json<PSSelectionData>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    println!(
        "[PS HTTP] Received selection: {}x{}, mode: {}",
        data.width, data.height, data.mode
    );

    // 清除之前的结果
    {
        let mut result = get_ps_result_store().lock().unwrap();
        *result = None;
    }

    // Emit event to frontend - 前端会自动生成
    if let Err(e) = app_handle.emit("ps-selection-received", &data) {
        eprintln!("[PS HTTP] Failed to emit event: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 等待前端生成完成（最多等待 120 秒）
    let timeout = std::time::Duration::from_secs(120);
    let start = std::time::Instant::now();

    loop {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        if let Ok(result) = get_ps_result_store().lock() {
            if let Some(ref image_data) = *result {
                println!("[PS HTTP] Generation complete, returning result");
                return Ok(Json(serde_json::json!({
                    "success": true,
                    "image": image_data,
                    "message": "Generation complete"
                })));
            }
        }

        if start.elapsed() > timeout {
            println!("[PS HTTP] Generation timeout");
            return Ok(Json(serde_json::json!({
                "success": false,
                "message": "Generation timeout"
            })));
        }
    }
}

/// 前端调用此接口提交生成结果
async fn submit_ps_result(
    Json(data): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if let Some(image) = data.get("image").and_then(|v| v.as_str()) {
        let mut result = get_ps_result_store().lock().unwrap();
        *result = Some(image.to_string());
        println!("[PS HTTP] Result submitted");
        Ok(Json(serde_json::json!({ "success": true })))
    } else {
        Err(StatusCode::BAD_REQUEST)
    }
}

// ── 嵌入浏览器控制 ──────────────────────────────────────

#[tauri::command]
pub async fn open_embedded_browser(
    app: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use tauri::{LogicalPosition, LogicalSize, Url};

        // Close existing embedded browser if any
        let _ = close_embedded_browser(app.clone()).await;

        let parsed_url = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;

        // Get the main window (not WebviewWindow, but Window for add_child)
        let window = app.get_window("main").ok_or("Main window not found")?;

        // Create a WebviewBuilder for the embedded browser
        let webview_builder = tauri::webview::WebviewBuilder::new(
            "embedded_browser",
            tauri::WebviewUrl::External(parsed_url),
        )
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0")
        .transparent(true);

        // Add as child webview within the main window
        window
            .add_child(
                webview_builder,
                LogicalPosition::new(x, y),
                LogicalSize::new(width, height),
            )
            .map_err(|e| format!("Failed to create embedded webview: {}", e))?;

        // Track the webview
        if let Ok(mut store) = EMBEDDED_WEBVIEWS.lock() {
            store.webviews.insert("embedded_browser".to_string(), true);
        }

        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Embedded browser not supported on mobile".to_string())
    }
}

#[tauri::command]
pub async fn close_embedded_browser(app: AppHandle) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Some(webview) = app.get_webview("embedded_browser") {
            webview
                .close()
                .map_err(|e| format!("Failed to close: {}", e))?;
        }

        if let Ok(mut store) = EMBEDDED_WEBVIEWS.lock() {
            store.webviews.remove("embedded_browser");
        }
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn navigate_embedded_browser(app: AppHandle, url: String) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use tauri::Url;
        if let Some(webview) = app.get_webview("embedded_browser") {
            let parsed_url = Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
            webview
                .navigate(parsed_url)
                .map_err(|e| format!("Navigation failed: {}", e))?;
        }
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn resize_embedded_browser(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use tauri::{LogicalPosition, LogicalSize};
        if let Some(webview) = app.get_webview("embedded_browser") {
            webview
                .set_position(LogicalPosition::new(x, y))
                .map_err(|e| format!("Position failed: {}", e))?;
            webview
                .set_size(LogicalSize::new(width, height))
                .map_err(|e| format!("Size failed: {}", e))?;
        }
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn show_embedded_browser(app: AppHandle) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Some(webview) = app.get_webview("embedded_browser") {
            webview.show().map_err(|e| format!("Show failed: {}", e))?;
        }
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn hide_embedded_browser(app: AppHandle) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Some(webview) = app.get_webview("embedded_browser") {
            webview.hide().map_err(|e| format!("Hide failed: {}", e))?;
        }
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn is_browser_open(app: AppHandle) -> bool {
    app.get_webview("embedded_browser").is_some()
}

#[tauri::command]
pub async fn zoom_embedded_browser(app: AppHandle, zoom_level: f64) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Some(webview) = app.get_webview("embedded_browser") {
            // Use CSS zoom property via JavaScript
            let js = format!("document.body.style.zoom = '{}';", zoom_level);
            webview
                .eval(&js)
                .map_err(|e| format!("Zoom failed: {}", e))?;
        }
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn inject_css(app: AppHandle, css: String) -> Result<(), String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        if let Some(webview) = app.get_webview("embedded_browser") {
            let js = format!(
                "(function() {{
                    var style = document.createElement('style');
                    style.textContent = `{}`;
                    document.head.appendChild(style);
                }})()",
                css.replace("`", "\\`")
            );
            webview
                .eval(&js)
                .map_err(|e| format!("CSS injection failed: {}", e))?;
        }
        Ok(())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(())
    }
}
