mod filesystem;
mod terminal;
mod search;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    tauri::Builder::default()

        .plugin(
            tauri_plugin_opener::init()
        )


        .manage(
            terminal::TerminalState {
                writers: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
                owners: std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
            }
        )


        .invoke_handler(
            tauri::generate_handler![
                filesystem::read_directory,
                filesystem::get_home_directory,

                terminal::start_terminal,
                terminal::write_terminal,
                terminal::close_terminal,

                search::search_files
            ]
        )


        .run(
            tauri::generate_context!()
        )


        .expect(
            "error while running tauri"
        );

}