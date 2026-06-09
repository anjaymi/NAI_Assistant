// 局域网直连命令模块
// 包含：IP 探测、LAN Ping、文件直传

/// 通过 UDP 探测本机局域网 IP 地址
#[tauri::command]
pub fn get_local_ip() -> String {
    use std::net::UdpSocket;
    // Connect to an external IP (doesn't actually send a packet just routes it)
    let socket = UdpSocket::bind("0.0.0.0:0");
    match socket {
        Ok(s) => {
            if s.connect("8.8.8.8:80").is_ok() {
                if let Ok(addr) = s.local_addr() {
                    return addr.ip().to_string();
                }
            }
        }
        Err(_) => {}
    }
    // Fallback Localhost
    "127.0.0.1".to_string()
}

/// 在 Rust 原生层发起 HTTP GET 探测局域网 PC 是否在线
/// 完全绕过 WebView 的 Mixed Content 限制和 Tauri HTTP 插件的兼容性问题
#[tauri::command]
pub async fn ping_lan(ip: String) -> Result<bool, String> {
    let clean_ip = ip.split(':').next().unwrap_or(&ip).trim();
    let url = format!("http://{}:38080/api/airdrop/ping", clean_ip);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;
    
    match client.get(&url).send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(err) => Err(format!("Rust Reqwest Error: {}", err)),
    }
}

/// 在 Rust 原生层通过局域网上传文件到 PC
/// 接收 base64 编码的文件数据，在 Rust 层解码后用 reqwest multipart 上传
#[tauri::command]
pub async fn upload_to_lan(ip: String, file_data: Vec<u8>, file_name: String) -> Result<bool, String> {
    let clean_ip = ip.split(':').next().unwrap_or(&ip).trim();
    let url = format!("http://{}:38080/api/airdrop/upload", clean_ip);
    
    let part = reqwest::multipart::Part::bytes(file_data)
        .file_name(file_name)
        .mime_str("image/png")
        .map_err(|e| format!("MIME error: {}", e))?;
    
    let form = reqwest::multipart::Form::new()
        .part("fileToUpload", part);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;
    
    match client.post(&url).multipart(form).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                Ok(true)
            } else {
                Err(format!("Upload failed: HTTP {}", resp.status()))
            }
        }
        Err(e) => Err(format!("Upload error: {}", e)),
    }
}
