mod commands;
use commands::file::{import_paper, list_papers, get_paper, get_questions, delete_paper, reset_paper, read_answer_file, save_answers, save_session};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            import_paper, list_papers, get_paper, get_questions,
            delete_paper, reset_paper, read_answer_file, save_answers, save_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
