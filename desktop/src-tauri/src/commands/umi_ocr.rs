// Umi-OCR external engine integration
// Umi-OCR (PaddleOCR v3 C++ engine) exposes an HTTP API on 127.0.0.1:1224.
// This module proxies OCR calls from the frontend to that service, spawning
// Umi-OCR automatically if it isn't already running.
// Discovery order: bundled resource dir (installed app) → D:\Umi-OCR (manual install).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::Duration;

use tauri::Manager;

use crate::commands::ocr::OcrLine;

const UMI_URL: &str = "http://127.0.0.1:1224";
const UMI_EXE_MANUAL: &str = "D:\\Umi-OCR\\Umi-OCR.exe";
// Cache probe results: once we know the service is reachable, skip the probe
// (Umi-OCR HTTP service stays up until the process exits).
static UMI_PROBED: AtomicBool = AtomicBool::new(false);
// Resolved exe path (probed once, then cached for the session)
static UMI_EXE: OnceLock<String> = OnceLock::new();

/// Locate Umi-OCR.exe: bundled resource dir first, then manual D:\Umi-OCR.
fn resolve_umi_exe(app: &tauri::AppHandle) -> String {
    if let Some(p) = UMI_EXE.get() {
        return p.clone();
    }
    let mut path: Option<String> = None;
    // 1. Bundled with the app (MSI installs resources under the install dir)
    if let Ok(res) = app.path().resource_dir() {
        let candidate = res.join("Umi-OCR").join("Umi-OCR.exe");
        if candidate.exists() {
            path = Some(candidate.to_string_lossy().to_string());
        }
    }
    // 2. Manual install on D:
    if path.is_none() && std::path::Path::new(UMI_EXE_MANUAL).exists() {
        path = Some(UMI_EXE_MANUAL.to_string());
    }
    let resolved = path.unwrap_or_else(|| UMI_EXE_MANUAL.to_string());
    let _ = UMI_EXE.set(resolved.clone());
    resolved
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(2))
        .timeout(Duration::from_secs(90))
        .build()
        .expect("failed to build http client")
}

/// Check whether the Umi-OCR HTTP service is reachable.
async fn umi_service_alive() -> bool {
    let client = http_client();
    match client
        .get(format!("{UMI_URL}/api/ocr/get_options"))
        .send()
        .await
    {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

/// Try to start Umi-OCR from the resolved location.
fn try_spawn_umi(app: &tauri::AppHandle) -> Result<(), String> {
    let exe = resolve_umi_exe(app);
    if !std::path::Path::new(&exe).exists() {
        return Err(format!("未找到 Umi-OCR 引擎（{exe}）。请从 https://hiroi-sora.lanzoul.com/s/umi-ocr 下载便携版并解压到 D:\\Umi-OCR"));
    }
    std::process::Command::new(&exe)
        .spawn()
        .map_err(|e| format!("启动 Umi-OCR 失败: {e}"))?;
    Ok(())
}

/// Ensure the Umi-OCR service is running: probe, spawn if needed, wait for ready.
async fn ensure_umi_running(app: &tauri::AppHandle) -> Result<(), String> {
    // Fast path: already probed and reachable this session
    if UMI_PROBED.load(Ordering::Relaxed) && umi_service_alive().await {
        return Ok(());
    }

    // Not probed or service down — try spawning Umi-OCR
    if let Err(e) = try_spawn_umi(app) {
        return Err(e);
    }

    // Poll until the HTTP service is ready (Umi-OCR engine init can take seconds)
    for _ in 0..30 {
        if umi_service_alive().await {
            UMI_PROBED.store(true, Ordering::Relaxed);
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Err("Umi-OCR 启动超时（15s 内未就绪）".to_string())
}

/// OCR one image via Umi-OCR HTTP API. Returns recognized lines.
/// On any failure, returns Err so the frontend can fall back to Windows OCR.
#[tauri::command]
pub async fn umi_ocr_image(app: tauri::AppHandle, base64_img: String) -> Result<Vec<OcrLine>, String> {
    ensure_umi_running(&app).await?;

    let body = serde_json::json!({
        "base64": base64_img,
        "options": {
            "tbpu.parser": "multi_para",
            "data.format": "text",
            "ocr.limit_side_len": 2880,
        }
    });

    let client = http_client();
    let resp = client
        .post(format!("{UMI_URL}/api/ocr"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("调用 Umi-OCR 失败: {e}"))?;

    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("解析 Umi-OCR 响应失败: {e}"))?;

    let code = json["code"].as_i64().unwrap_or(-1);
    if code != 100 {
        // code 101 = no text found — treat as empty result, not an error worth
        // falling back for (the page may genuinely be blank / image-only)
        if code == 101 {
            return Ok(vec![]);
        }
        return Err(format!("Umi-OCR 返回错误码 {code}: {}", json["msg"].as_str().unwrap_or("")));
    }

    // data.format=text → data is a plain string
    let text = json["data"].as_str().unwrap_or("");
    let lines: Vec<OcrLine> = text
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| OcrLine { text: l.to_string(), confidence: 0.0 })
        .collect();
    Ok(lines)
}
