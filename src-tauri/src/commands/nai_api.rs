// NAI 云端 API 命令模块
// 包含：Token 验证、Anlas 余额、图片放大、背景去除

use serde::{Deserialize, Serialize};
use std::time::Duration;

const NOVELAI_SUBSCRIPTION_URL: &str = "https://api.novelai.net/user/subscription";
// ── 数据结构 ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct VerifyTokenResult {
    pub valid: bool,
    pub tier: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnlasResult {
    pub success: bool,
    pub fixed: Option<i64>,
    pub purchased: Option<i64>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SubscriptionResponse {
    tier: Option<i32>,
    #[serde(rename = "trainingStepsLeft")]
    training_steps_left: Option<TrainingSteps>,
}

#[derive(Debug, Deserialize)]
struct TrainingSteps {
    #[serde(rename = "fixedTrainingStepsLeft")]
    fixed_training_steps_left: Option<i64>,
    #[serde(rename = "purchasedTrainingSteps")]
    purchased_training_steps: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ProxySubscriptionResponse {
    valid: bool,
    tier: Option<i32>,
    #[serde(rename = "trainingStepsLeft")]
    training_steps_left: Option<TrainingSteps>,
    error: Option<String>,
    detail: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpscaleResult {
    pub success: bool,
    pub image_data: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
struct UpscalePayload {
    image: String,
    width: i32,
    height: i32,
    scale: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemoveBackgroundResult {
    pub success: bool,
    pub image_data: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerateImageResult {
    pub success: bool,
    pub image_data: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PreparedImg2ImgInput {
    pub image: String,
    pub mask: Option<String>,
    pub width: u32,
    pub height: u32,
    pub source_width: u32,
    pub source_height: u32,
}

// ── Tauri 命令 ───────────────────────────────────────────

fn build_novelai_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(20))
        .user_agent("NAI_Assistant/0.12.1")
        .build()
        .map_err(|e| format!("HTTP client init failed: {e}"))
}

fn parse_tier_name(tier: Option<i32>) -> Option<String> {
    match tier {
        Some(3) => Some("opus".to_string()),
        Some(2) => Some("scroll".to_string()),
        Some(1) => Some("tablet".to_string()),
        _ => Some("paper".to_string()),
    }
}

async fn fetch_subscription_direct(
    client: &reqwest::Client,
    clean_token: &str,
) -> Result<SubscriptionResponse, String> {
    let response = client
        .get(NOVELAI_SUBSCRIPTION_URL)
        .header("Authorization", format!("Bearer {}", clean_token))
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("Network Error: {e}"))?;

    let status = response.status();
    if status.is_success() {
        response
            .json::<SubscriptionResponse>()
            .await
            .map_err(|e| format!("JSON parse error: {e}"))
    } else if status.as_u16() == 401 {
        Err("Invalid API token".to_string())
    } else {
        let error_text = response.text().await.unwrap_or_default();
        Err(format!("API error: {} ({})", status.as_u16(), error_text))
    }
}

async fn fetch_subscription_via_proxy(
    client: &reqwest::Client,
    clean_token: &str,
    proxy_url: &str,
) -> Result<SubscriptionResponse, String> {
    let response = client
        .post(proxy_url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "token": clean_token }))
        .send()
        .await
        .map_err(|e| format!("Proxy Network Error: {e}"))?;

    let status = response.status();
    let proxy = response
        .json::<ProxySubscriptionResponse>()
        .await
        .map_err(|e| format!("Proxy JSON parse error: {e}"))?;

    if status.is_success() && proxy.valid {
        Ok(SubscriptionResponse {
            tier: proxy.tier,
            training_steps_left: proxy.training_steps_left,
        })
    } else {
        Err(proxy
            .error
            .or(proxy.detail)
            .unwrap_or_else(|| format!("Proxy API error: {}", status.as_u16())))
    }
}

#[tauri::command]
pub async fn verify_token(token: String, proxy_url: Option<String>) -> VerifyTokenResult {
    let client = match build_novelai_client() {
        Ok(client) => client,
        Err(error) => {
            return VerifyTokenResult {
                valid: false,
                tier: None,
                error: Some(error),
            }
        }
    };

    let trimmed_token = token.trim();
    // Remove "Bearer " prefix if user pasted it
    let clean_token = if trimmed_token.to_lowercase().starts_with("bearer ") {
        &trimmed_token[7..]
    } else {
        trimmed_token
    };

    println!(
        "[VerifyToken] Checking token (length: {})",
        clean_token.len()
    );
    println!("[VerifyToken] Token value redacted");

    // Debug: Check Proxy Env Vars
    println!(
        "[VerifyToken] HTTP_PROXY: {:?}",
        std::env::var("HTTP_PROXY")
    );
    println!(
        "[VerifyToken] HTTPS_PROXY: {:?}",
        std::env::var("HTTPS_PROXY")
    );
    println!("[VerifyToken] ALL_PROXY: {:?}", std::env::var("ALL_PROXY"));

    match fetch_subscription_direct(&client, clean_token).await {
        Ok(data) => VerifyTokenResult {
            valid: true,
            tier: parse_tier_name(data.tier),
            error: None,
        },
        Err(direct_error) => {
            println!("[VerifyToken] Direct request failed: {}", direct_error);
            let fallback_proxy_url = proxy_url.as_deref().map(str::trim).filter(|url| !url.is_empty());
            match fallback_proxy_url {
                Some(url) => match fetch_subscription_via_proxy(&client, clean_token, url).await {
                Ok(data) => VerifyTokenResult {
                    valid: true,
                    tier: parse_tier_name(data.tier),
                    error: None,
                },
                Err(proxy_error) => VerifyTokenResult {
                    valid: false,
                    tier: None,
                    error: Some(format!("{}; Proxy fallback failed: {}", direct_error, proxy_error)),
                },
                },
                None => VerifyTokenResult {
                    valid: false,
                    tier: None,
                    error: Some(direct_error),
                },
            }
        }
    }
}

#[tauri::command]
pub async fn get_anlas_balance(token: String, proxy_url: Option<String>) -> AnlasResult {
    let client = match build_novelai_client() {
        Ok(client) => client,
        Err(error) => {
            return AnlasResult {
                success: false,
                fixed: None,
                purchased: None,
                error: Some(error),
            }
        }
    };

    let trimmed = token.trim();
    let clean_token = if trimmed.to_lowercase().starts_with("bearer ") {
        &trimmed[7..]
    } else {
        trimmed
    };

    let subscription = match fetch_subscription_direct(&client, clean_token).await {
        Ok(data) => Ok(data),
        Err(direct_error) => {
            println!("[GetAnlas] Direct request failed: {}", direct_error);
            if let Some(url) = proxy_url.as_deref().map(str::trim).filter(|url| !url.is_empty()) {
                fetch_subscription_via_proxy(&client, clean_token, url)
                    .await
                    .map_err(|proxy_error| format!("{}; Proxy fallback failed: {}", direct_error, proxy_error))
            } else {
                Err(direct_error)
            }
        }
    };

    match subscription {
        Ok(data) => {
            let fixed = data
                .training_steps_left
                .as_ref()
                .and_then(|t| t.fixed_training_steps_left);
            let purchased = data
                .training_steps_left
                .as_ref()
                .and_then(|t| t.purchased_training_steps);
            AnlasResult {
                success: true,
                fixed,
                purchased,
                error: None,
            }
        }
        Err(error) => AnlasResult {
            success: false,
            fixed: None,
            purchased: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub async fn generate_image_backend(token: String, body: serde_json::Value) -> GenerateImageResult {
    let client = match reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(180))
        .user_agent("NAI_Assistant/1.0")
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            return GenerateImageResult {
                success: false,
                image_data: None,
                error: Some(format!("HTTP client init failed: {error}")),
            }
        }
    };

    let response = match client
        .post("https://image.novelai.net/ai/generate-image")
        .header("Authorization", format!("Bearer {}", token.trim()))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            return GenerateImageResult {
                success: false,
                image_data: None,
                error: Some(format!("Network Error: {error}")),
            }
        }
    };

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        println!("[GenerateBackend] API Error {}: {}", status.as_u16(), error_text);
        println!(
            "[GenerateBackend] Payload summary: action={:?}, model={:?}, width={:?}, height={:?}, has_image={}, has_mask={}",
            body.get("action"),
            body.get("model"),
            body.pointer("/parameters/width"),
            body.pointer("/parameters/height"),
            body.pointer("/parameters/image").is_some(),
            body.pointer("/parameters/mask").is_some()
        );
        return GenerateImageResult {
            success: false,
            image_data: None,
            error: Some(format!("API Error: {} - {}", status.as_u16(), error_text)),
        };
    }

    let bytes = match response.bytes().await {
        Ok(bytes) => bytes,
        Err(error) => {
            return GenerateImageResult {
                success: false,
                image_data: None,
                error: Some(format!("Response read error: {error}")),
            }
        }
    };

    match extract_image_from_zip(&bytes) {
        Ok(image_data) => GenerateImageResult {
            success: true,
            image_data: Some(image_data),
            error: None,
        },
        Err(error) => GenerateImageResult {
            success: false,
            image_data: None,
            error: Some(format!("ZIP parse error: {error}")),
        },
    }
}

#[tauri::command]
pub async fn prepare_img2img_input_backend(
    source: String,
    mask: Option<String>,
) -> Result<PreparedImg2ImgInput, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageBuffer, ImageFormat, Rgba};
    use std::io::Cursor;

    fn strip_data_url(input: &str) -> &str {
        input
            .split_once(',')
            .filter(|(prefix, _)| prefix.starts_with("data:image/"))
            .map(|(_, data)| data)
            .unwrap_or(input)
    }

    fn round_to_64(value: u32) -> u32 {
        ((value + 32) / 64).max(1) * 64
    }

    fn encode_png(image: DynamicImage) -> Result<String, String> {
        let mut cursor = Cursor::new(Vec::new());
        image
            .write_to(&mut cursor, ImageFormat::Png)
            .map_err(|error| format!("PNG encode error: {error}"))?;
        Ok(STANDARD.encode(cursor.into_inner()))
    }

    let source_base64 = strip_data_url(&source).to_string();
    let source_bytes = STANDARD
        .decode(&source_base64)
        .map_err(|error| format!("Source base64 decode error: {error}"))?;
    let source_image = image::load_from_memory(&source_bytes)
        .map_err(|error| format!("Source image decode error: {error}"))?;
    let (source_width, source_height) = source_image.dimensions();
    let target_width = round_to_64(source_width);
    let target_height = round_to_64(source_height);
    let prepared_source = if target_width == source_width && target_height == source_height {
        source_base64
    } else {
        encode_png(source_image.resize_exact(target_width, target_height, FilterType::Lanczos3))?
    };

    let prepared_mask = match mask {
        Some(mask_source) => {
            let mask_bytes = STANDARD
                .decode(strip_data_url(&mask_source))
                .map_err(|error| format!("Mask base64 decode error: {error}"))?;
            let mask_image = image::load_from_memory(&mask_bytes)
                .map_err(|error| format!("Mask image decode error: {error}"))?
                .resize_exact(target_width, target_height, FilterType::Nearest)
                .to_rgba8();

            let mut output = ImageBuffer::<Rgba<u8>, Vec<u8>>::new(target_width, target_height);
            for (x, y, pixel) in mask_image.enumerate_pixels() {
                let value = if pixel[3] != 0 { 255 } else { 0 };
                output.put_pixel(x, y, Rgba([value, value, value, 255]));
            }

            Some(encode_png(DynamicImage::ImageRgba8(output))?)
        }
        None => None,
    };

    Ok(PreparedImg2ImgInput {
        image: prepared_source,
        mask: prepared_mask,
        width: target_width,
        height: target_height,
        source_width,
        source_height,
    })
}

#[tauri::command]
pub async fn upscale_image(
    token: String,
    image: String,
    width: i32,
    height: i32,
    scale: i32,
) -> UpscaleResult {
    let client = reqwest::Client::new();

    let payload = UpscalePayload {
        image,
        width,
        height,
        scale,
    };

    let result = client
        .post("https://api.novelai.net/ai/upscale")
        .header("Authorization", format!("Bearer {}", token.trim()))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await;

    match result {
        Ok(response) => {
            if response.status().is_success() {
                // Response is a ZIP file containing the image
                match response.bytes().await {
                    Ok(bytes) => {
                        // Use zip crate to extract
                        match extract_image_from_zip(&bytes) {
                            Ok(base64_image) => UpscaleResult {
                                success: true,
                                image_data: Some(base64_image),
                                error: None,
                            },
                            Err(e) => UpscaleResult {
                                success: false,
                                image_data: None,
                                error: Some(format!("ZIP 처리 오류: {}", e)),
                            },
                        }
                    }
                    Err(e) => UpscaleResult {
                        success: false,
                        image_data: None,
                        error: Some(format!("응답 읽기 오류: {}", e)),
                    },
                }
            } else {
                let status = response.status().as_u16();
                let error_text = response.text().await.unwrap_or_default();
                UpscaleResult {
                    success: false,
                    image_data: None,
                    error: Some(format!("API 오류 {}: {}", status, error_text)),
                }
            }
        }
        Err(e) => UpscaleResult {
            success: false,
            image_data: None,
            error: Some(format!("네트워크 오류: {}", e)),
        },
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn extract_image_from_zip(zip_bytes: &[u8]) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use std::io::{Cursor, Read};
    use zip::ZipArchive;

    let cursor = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    if archive.is_empty() {
        return Err("ZIP 파일이 비어있습니다".to_string());
    }

    let mut file = archive.by_index(0).map_err(|e| e.to_string())?;
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).map_err(|e| e.to_string())?;

    Ok(STANDARD.encode(&contents))
}

#[cfg(any(target_os = "android", target_os = "ios"))]
fn extract_image_from_zip(_zip_bytes: &[u8]) -> Result<String, String> {
    Err("ZIP extraction is not supported on mobile platforms".to_string())
}

#[tauri::command]
pub async fn remove_background(image_base64: String) -> RemoveBackgroundResult {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    // Decode base64 image
    let image_bytes = match STANDARD.decode(&image_base64) {
        Ok(bytes) => bytes,
        Err(e) => {
            return RemoveBackgroundResult {
                success: false,
                image_data: None,
                error: Some(format!("Base64 디코딩 오류: {}", e)),
            }
        }
    };

    let client = reqwest::Client::new();

    // Use Hugging Face Inference API (free tier available)
    let result = client
        .post("https://router.huggingface.co/hf-inference/models/briaai/RMBG-1.4")
        .header("Content-Type", "application/octet-stream")
        .body(image_bytes)
        .send()
        .await;

    match result {
        Ok(response) => {
            if response.status().is_success() {
                match response.bytes().await {
                    Ok(bytes) => {
                        let base64_result = STANDARD.encode(&bytes);
                        RemoveBackgroundResult {
                            success: true,
                            image_data: Some(format!("data:image/png;base64,{}", base64_result)),
                            error: None,
                        }
                    }
                    Err(e) => RemoveBackgroundResult {
                        success: false,
                        image_data: None,
                        error: Some(format!("응답 읽기 오류: {}", e)),
                    },
                }
            } else {
                let status = response.status().as_u16();
                let error_text = response.text().await.unwrap_or_default();
                RemoveBackgroundResult {
                    success: false,
                    image_data: None,
                    error: Some(format!("API 오류 {}: {}", status, error_text)),
                }
            }
        }
        Err(e) => RemoveBackgroundResult {
            success: false,
            image_data: None,
            error: Some(format!("네트워크 오류: {}", e)),
        },
    }
}
