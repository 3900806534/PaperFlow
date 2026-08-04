mod commands;

use commands::file::{import_paper, list_papers, get_paper, get_questions, delete_paper, reset_paper, read_answer_file, save_answers, save_session};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // On second launch, focus existing main window instead of creating new one
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                // Emit event to check for duplicate
                let _ = handle;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_paper,
            list_papers,
            get_paper,
            get_questions,
            delete_paper,
            reset_paper,
            read_answer_file,
            save_answers,
            save_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
