// 系统工具命令模块
// 包含：问候、语言探测、文件管理器、窗口移动、图片读取

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub fn get_system_language() -> String {
    // Stub for now to unblock build
    "en-US".to_string()
}

#[tauri::command]
pub async fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        // Suppress unused warning on other platforms
        let _ = path;
    }
    Ok(())
}

// move_window: called from JS pointermove with coordinates from JS pointer events.
// Uses Win32 SetWindowPos directly — bypasses GetCursorPos which fails with Windows Ink.
#[tauri::command]
pub fn move_window<R: tauri::Runtime>(window: tauri::Window<R>, x: i32, y: i32) {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, SWP_NOACTIVATE, SWP_NOSIZE, SWP_NOZORDER,
        };
        if let Ok(hwnd_wrapper) = window.hwnd() {
            let hwnd = windows::Win32::Foundation::HWND(hwnd_wrapper.0);
            unsafe {
                let _ = SetWindowPos(
                    hwnd,
                    Some(windows::Win32::Foundation::HWND(std::ptr::null_mut())),
                    x,
                    y,
                    0,
                    0,
                    SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
                );
            }
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "android", target_os = "ios")))]
    {
        // Fallback for non-Windows Desktop: use Tauri API
        use tauri::PhysicalPosition;
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
}

#[tauri::command]
pub async fn read_image_base64(path: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use std::io::Read;
    // Basic verification - ensure it's an image
    if !path.to_lowercase().ends_with(".png") && !path.to_lowercase().ends_with(".jpg") && !path.to_lowercase().ends_with(".jpeg") && !path.to_lowercase().ends_with(".webp") {
        return Err("Invalid file type".to_string());
    }
    
    let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
    
    Ok(STANDARD.encode(&buffer)) 
}

#[tauri::command]
pub async fn create_canvas_preview_image(
    app: tauri::AppHandle,
    source: String,
    max_size: Option<u32>,
) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use image::codecs::jpeg::JpegEncoder;
    use image::GenericImageView;
    use std::fs;
    use std::io::BufWriter;
    use tauri::Manager;

    let raw_base64 = source
        .split_once(',')
        .map(|(_, data)| data)
        .unwrap_or(source.as_str());
    let bytes = STANDARD.decode(raw_base64).map_err(|e| e.to_string())?;
    let image = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let (width, height) = image.dimensions();
    let max_size = max_size.unwrap_or(768).max(1);
    let scale = (max_size as f32 / width as f32)
        .min(max_size as f32 / height as f32)
        .min(1.0);
    let target_width = ((width as f32 * scale).round() as u32).max(1);
    let target_height = ((height as f32 * scale).round() as u32).max(1);
    let resized = image.resize(target_width, target_height, image::imageops::FilterType::Triangle);

    let preview_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("canvas-previews");
    fs::create_dir_all(&preview_dir).map_err(|e| e.to_string())?;
    let preview_path = preview_dir.join(format!(
        "canvas_preview_{}.jpg",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis()
    ));

    let file = fs::File::create(&preview_path).map_err(|e| e.to_string())?;
    let mut writer = BufWriter::new(file);
    let rgb = resized.to_rgb8();
    let mut encoder = JpegEncoder::new_with_quality(&mut writer, 78);
    encoder
        .encode(
            &rgb,
            rgb.width(),
            rgb.height(),
            image::ExtendedColorType::Rgb8,
        )
        .map_err(|e| e.to_string())?;

    Ok(preview_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn copy_image_to_clipboard(path: String) -> Result<(), String> {
    if !path.to_lowercase().ends_with(".png")
        && !path.to_lowercase().ends_with(".jpg")
        && !path.to_lowercase().ends_with(".jpeg")
        && !path.to_lowercase().ends_with(".webp")
    {
        return Err("Invalid file type".to_string());
    }

    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let image = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();

    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard
        .set_image(arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: std::borrow::Cow::Owned(rgba.into_raw()),
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}
