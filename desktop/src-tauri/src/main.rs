#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Single instance lock
    use std::sync::OnceLock;
    use std::process;
    
    // This is handled by Tauri's plugin system in v2
    // We'll add it in lib.rs instead
    paperflow_lib::run()
}
