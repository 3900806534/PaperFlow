use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Paper {
    pub id: String,
    pub title: String,
    pub file_name: String,
    pub file_path: String,
    pub total_questions: i32,
    pub question_types: String, // JSON array
    pub parsed_at: i64,
    pub status: String,
    pub has_answer_key: bool,
    pub answer_key_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedQuestion {
    pub id: String,
    pub paper_id: String,
    pub index: i32,
    #[serde(rename = "type")]
    pub question_type: String,
    pub stem: String,
    pub options: String, // JSON array
    pub raw_text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StandardAnswer {
    #[serde(rename = "questionId")]
    pub question_id: String,
    pub answer: Vec<String>,
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserAnswer {
    #[serde(rename = "questionId")]
    pub question_id: String,
    pub answer: Vec<String>,
    #[serde(rename = "answeredAt")]
    pub answered_at: i64,
    pub duration: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PracticeSession {
    pub id: String,
    #[serde(rename = "paperId")]
    pub paper_id: String,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    #[serde(rename = "lastActiveAt")]
    pub last_active_at: i64,
    #[serde(rename = "completedQuestionIds")]
    pub completed_question_ids: Vec<String>,
    #[serde(rename = "currentQuestionIndex")]
    pub current_question_index: i32,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GradeSummary {
    #[serde(rename = "paperId")]
    pub paper_id: String,
    #[serde(rename = "totalQuestions")]
    pub total_questions: i32,
    #[serde(rename = "answeredQuestions")]
    pub answered_questions: i32,
    #[serde(rename = "correctCount")]
    pub correct_count: i32,
    pub accuracy: f64,
    #[serde(rename = "totalDuration")]
    pub total_duration: i32,
}

fn get_data_dir() -> PathBuf {
    PathBuf::from("D:/PaperFlowData")
}

fn get_pdf_dir() -> PathBuf {
    let dir = get_data_dir().join("papers");
    fs::create_dir_all(&dir).ok();
    dir
}

fn get_db_path() -> String {
    get_data_dir().join("paperflow.db").to_string_lossy().to_string()
}

#[tauri::command]
pub async fn import_paper(file_path: String) -> Result<Paper, String> {
    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let title = file_name.replace(".pdf", "").replace(".PDF", "");
    let paper_id = uuid::Uuid::new_v4().to_string();

    // Copy PDF to data directory
    let dest_dir = get_pdf_dir();
    let dest_path = dest_dir.join(&file_name);
    fs::copy(&file_path, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    // Read PDF text using a simple approach (text extraction happens on frontend via pdf.js)
    // Here we just store the file reference
    let now = chrono::Utc::now().timestamp_millis();
    
    // Extract text from PDF using pdf-extract or similar
    // For now, we read the raw bytes and let the frontend handle parsing
    let pdf_bytes = fs::read(&dest_path).map_err(|e| format!("Failed to read PDF: {}", e))?;
    
    // Use a simple Rust PDF text extraction
    let raw_text = extract_pdf_text(&pdf_bytes)?;
    
    // Parse questions from text (basic server-side parsing)
    let questions = parse_questions_basic(&paper_id, &raw_text);
    let total = questions.len() as i32;
    
    // Store questions in DB
    
    let paper = Paper {
        id: paper_id.clone(),
        title,
        file_name,
        file_path: dest_path.to_string_lossy().to_string(),
        total_questions: total,
        question_types: serde_json::to_string(&vec!["single"]).unwrap_or_default(),
        parsed_at: now,
        status: "ready".to_string(),
        has_answer_key: false,
        answer_key_path: None,
    };

    Ok(paper)
}

/// Basic PDF text extraction - extracts text from simple text-based PDFs
fn extract_pdf_text(data: &[u8]) -> Result<String, String> {
    // Use pdf_extract crate or basic text extraction
    // For a minimal implementation, extract text between stream/endstream and decode
    let content = String::from_utf8_lossy(data);
    let mut text = String::new();
    
    // Simple PDF text extraction: look for BT...ET blocks
    let mut in_text = false;
    for line in content.lines() {
        if line.trim() == "BT" {
            in_text = true;
            continue;
        }
        if line.trim() == "ET" {
            in_text = false;
            continue;
        }
        if in_text {
            // Extract text between parentheses in Tj/TJ operators
            for cap in extract_text_operators(line) {
                text.push_str(&cap);
            }
        }
    }
    
    if text.is_empty() {
        // Fallback: try to extract any readable text
        text = extract_readable_text(&content);
    }
    
    if text.trim().is_empty() {
        return Err("无法从PDF中提取文本，请确保PDF为文字型PDF（非扫描版）".to_string());
    }
    
    Ok(text)
}

fn extract_text_operators(line: &str) -> Vec<String> {
    let mut results = Vec::new();
    // Match (text) Tj patterns
    let mut chars = line.chars().peekable();
    while let Some(&c) = chars.peek() {
        if c == '(' {
            chars.next();
            let mut s = String::new();
            let mut depth = 1;
            while let Some(&ch) = chars.peek() {
                chars.next();
                if ch == '(' { depth += 1; }
                else if ch == ')' { depth -= 1; if depth == 0 { break; } }
                else { s.push(ch); }
            }
            if !s.is_empty() {
                results.push(s);
            }
        } else {
            chars.next();
        }
    }
    results
}

fn extract_readable_text(content: &str) -> String {
    // Extract any readable CJK and ASCII text from the raw PDF content.
    // Punctuation set: 中文标点、弯引号、省略号、破折号、间隔号
    content.chars()
        .filter(|c| c.is_alphanumeric() || c.is_whitespace() || 
                (*c >= '\u{4e00}' && *c <= '\u{9fff}') || // CJK Unified
                (*c >= '\u{3000}' && *c <= '\u{303f}') || // CJK punctuation
                (*c >= '\u{ff00}' && *c <= '\u{ffef}') || // Fullwidth forms
                "\u{ff0c}\u{3002}\u{3001}\u{ff1b}\u{ff1a}\u{ff1f}\u{ff01}\u{201c}\u{201d}\u{2018}\u{2019}\u{ff08}\u{ff09}\u{3010}\u{3011}\u{300a}\u{300b}\u{2026}\u{2014}\u{b7}".contains(*c))
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Basic server-side question parsing (frontend does the detailed parsing)
/// Uses a simple line-by-line approach: a new question begins when a line
/// starts with a digit followed by a separator (. 、 ． ) ）).
fn parse_questions_basic(paper_id: &str, text: &str) -> Vec<ParsedQuestion> {
    let mut questions = Vec::new();
    let lines: Vec<&str> = text.lines().collect();
    let mut start: Option<usize> = None;
    let mut index = 0;

    for (i, line) in lines.iter().enumerate() {
        if is_question_start(line) {
            if let Some(s) = start {
                let q_text = lines[s..i].join("\n");
                if !q_text.trim().is_empty() {
                    questions.push(build_question(paper_id, index, &q_text));
                }
                index += 1;
            }
            start = Some(i);
        }
    }

    // Last question: from the last question marker to the end of the text
    if let Some(s) = start {
        let q_text = lines[s..].join("\n");
        if !q_text.trim().is_empty() {
            questions.push(build_question(paper_id, index, &q_text));
        }
    }

    questions
}

/// Checks if a line starts with a digit followed by a separator,
/// e.g. "1." "2、" "3）" "4 ".
fn is_question_start(line: &str) -> bool {
    let mut chars = line.trim_start().chars();
    let mut saw_digit = false;
    while let Some(c) = chars.next() {
        if c.is_ascii_digit() {
            saw_digit = true;
        } else {
            return saw_digit && matches!(c, '.' | '、' | '．' | ')' | '）' | ' ');
        }
    }
    false
}

fn build_question(paper_id: &str, index: i32, text: &str) -> ParsedQuestion {
    let trimmed = text.trim();
    ParsedQuestion {
        id: format!("{}-q{}", paper_id, index),
        paper_id: paper_id.to_string(),
        index,
        question_type: "single".to_string(),
        stem: trimmed.lines().next().unwrap_or("").to_string(),
        options: "[]".to_string(),
        raw_text: trimmed.to_string(),
    }
}

#[tauri::command]
pub async fn list_papers() -> Result<Vec<Paper>, String> {
    // For now, return empty - full DB integration will be added
    Ok(Vec::new())
}

#[tauri::command]
pub async fn get_paper(paper_id: String) -> Result<Paper, String> {
    Err("Not yet implemented".to_string())
}

#[tauri::command]
pub async fn get_questions(paper_id: String) -> Result<Vec<ParsedQuestion>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn delete_paper(paper_id: String) -> Result<(), String> {
    // Delete paper file and DB records
    Ok(())
}

#[tauri::command]
pub async fn reset_paper(paper_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn read_answer_file(file_path: String) -> Result<String, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // If it's a PDF, extract text
    if file_path.to_lowercase().ends_with(".pdf") {
        let bytes = fs::read(&file_path).map_err(|e| format!("Failed to read PDF: {}", e))?;
        extract_pdf_text(&bytes)
    } else {
        Ok(content)
    }
}

#[tauri::command]
pub async fn save_answers(paper_id: String, answers: Vec<StandardAnswer>) -> Result<(), String> {
    // Save answers to DB
    let _ = (paper_id, answers);
    Ok(())
}

#[tauri::command]
pub async fn save_session(
    session: PracticeSession,
    user_answers: Vec<UserAnswer>,
    grade_summary: Option<GradeSummary>,
) -> Result<(), String> {
    let _ = (session, user_answers, grade_summary);
    Ok(())
}
