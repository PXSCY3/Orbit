use serde::Serialize;
use std::fs;
use std::path::Path;


#[derive(Serialize)]
pub struct FileEntry {

    pub name: String,

    pub path: String,

    pub is_directory: bool,

}



#[tauri::command]
pub fn read_directory(
    path: String
) -> Result<Vec<FileEntry>, String> {


    let entries =
        fs::read_dir(
            Path::new(&path)
        )
        .map_err(
            |e| e.to_string()
        )?;



    let mut files =
        Vec::new();



    for entry in entries {


        let entry =
            entry
                .map_err(
                    |e| e.to_string()
                )?;



        let path =
            entry.path();



        let name =
            path.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();



        files.push(
            FileEntry {

                name,

                path:
                    path.to_string_lossy()
                        .to_string(),

                is_directory:
                    path.is_dir(),

            }
        );


    }



    // folders first, then files
    files.sort_by(
        |a,b| {

            b.is_directory
                .cmp(&a.is_directory)
                .then(
                    a.name
                        .cmp(&b.name)
                )

        }
    );



    Ok(files)

}

#[tauri::command]
pub fn get_home_directory() -> String {
    std::env::var("HOME").unwrap_or_else(|_| "/home".into())
}