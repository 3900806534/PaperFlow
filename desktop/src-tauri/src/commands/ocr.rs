// Windows built-in OCR via WinRT (Media.Ocr) — zero models, fully offline
// Input: base64 JPEG/PNG → temp file → BitmapDecoder (file stream) → OcrEngine

use serde::Serialize;
use windows::{
    core::HSTRING,
    Graphics::Imaging::{BitmapDecoder, BitmapPixelFormat, SoftwareBitmap},
    Media::Ocr::OcrEngine,
    Storage::{FileAccessMode, StorageFile},
};

#[derive(Serialize)]
pub struct OcrLine {
    pub text: String,
    pub confidence: f32,
}

#[tauri::command]
pub async fn ocr_image(base64_img: String) -> Result<Vec<OcrLine>, String> {
    // 1. Decode base64 → temp file (keep original JPEG/PNG bytes)
    let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &base64_img)
        .map_err(|e| format!("base64解码失败: {}", e))?;
    // Normalize path: WinRT requires backslashes only
    let tmp_dir_str = "D:\\PaperFlowData\\tmp";
    std::fs::create_dir_all(tmp_dir_str).map_err(|e| format!("创建临时目录失败: {}", e))?;
    let tmp_path = format!("{}_ocr_{}.jpg", tmp_dir_str, uuid::Uuid::new_v4());
    std::fs::write(&tmp_path, &bytes).map_err(|e| format!("写临时文件失败: {}", e))?;

    let result = run_ocr(&tmp_path);
    let _ = std::fs::remove_file(&tmp_path);
    result
}

fn run_ocr(tmp_path: &str) -> Result<Vec<OcrLine>, String> {
    // 2. Open file via WinRT storage
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(tmp_path))
        .map_err(|e| format!("打开文件失败: {}", e))?
        .get()
        .map_err(|e| format!("等待打开失败: {}", e))?;

    let stream = file
        .OpenAsync(FileAccessMode::Read)
        .map_err(|e| format!("打开流失败: {}", e))?
        .get()
        .map_err(|e| format!("等待流失败: {}", e))?;

    // 3. Decode bitmap
    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|e| format!("创建解码器失败: {}", e))?
        .get()
        .map_err(|e| format!("等待解码器失败: {}", e))?;
    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|e| format!("获取位图失败: {}", e))?
        .get()
        .map_err(|e| format!("等待位图失败: {}", e))?;

    // 4. Convert to grayscale for better accuracy
    let gray = SoftwareBitmap::Convert(&bitmap, BitmapPixelFormat::Gray8)
        .map_err(|e| format!("灰度转换失败: {}", e))?;

    // 5. OCR engine from user profile (zh-CN system → Chinese OCR)
    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|e| format!("创建OCR引擎失败: {}", e))?;

    // 6. Recognize
    let result = engine
        .RecognizeAsync(&gray)
        .map_err(|e| format!("启动识别失败: {}", e))?
        .get()
        .map_err(|e| format!("等待识别失败: {}", e))?;

    // 7. Collect lines
    let mut lines = Vec::new();
    for line in result.Lines().map_err(|e| format!("读取行失败: {}", e))? {
        let text = line.Text().map_err(|e| format!("读取文本失败: {}", e))?.to_string();
        if !text.trim().is_empty() {
            lines.push(OcrLine { text, confidence: 0.0 });
        }
    }
    Ok(lines)
}
