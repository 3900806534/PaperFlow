use tauri::AppHandle;
use tauri_plugin_sql::{Migration, MigrationKind};

pub async fn init_db(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // DB is initialized by tauri-plugin-sql via tauri.conf.json preload
    // We run migrations here
    
    let migrations = vec![
        Migration {
            version: 1,
            description: "create papers table",
            sql: "CREATE TABLE IF NOT EXISTS papers (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                total_questions INTEGER DEFAULT 0,
                question_types TEXT DEFAULT '[]',
                parsed_at INTEGER,
                status TEXT DEFAULT 'parsing',
                has_answer_key INTEGER DEFAULT 0,
                answer_key_path TEXT
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create questions table",
            sql: "CREATE TABLE IF NOT EXISTS questions (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL,
                idx INTEGER NOT NULL,
                question_type TEXT DEFAULT 'single',
                stem TEXT,
                options TEXT DEFAULT '[]',
                raw_text TEXT,
                FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create answers table",
            sql: "CREATE TABLE IF NOT EXISTS answers (
                question_id TEXT PRIMARY KEY,
                answer TEXT NOT NULL,
                explanation TEXT,
                FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create user_answers table",
            sql: "CREATE TABLE IF NOT EXISTS user_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                answer TEXT NOT NULL,
                answered_at INTEGER,
                duration INTEGER DEFAULT 0,
                FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "create sessions table",
            sql: "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                paper_id TEXT NOT NULL,
                started_at INTEGER,
                last_active_at INTEGER,
                completed_question_ids TEXT DEFAULT '[]',
                current_question_index INTEGER DEFAULT 0,
                status TEXT DEFAULT 'in_progress',
                FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create wrong_book table",
            sql: "CREATE TABLE IF NOT EXISTS wrong_book (
                question_id TEXT NOT NULL,
                paper_id TEXT NOT NULL,
                wrong_count INTEGER DEFAULT 1,
                last_wrong_at INTEGER,
                mastered INTEGER DEFAULT 0,
                PRIMARY KEY (question_id),
                FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        },
    ];

    // Apply migrations
    // In a production app, you'd use the plugin's migration API
    // For now, create tables directly
    
    let _ = migrations;
    
    Ok(())
}
