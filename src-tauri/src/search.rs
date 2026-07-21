use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_SEARCH_RESULTS: usize = 100;

#[derive(Serialize)]
pub struct SearchResult {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
}

#[tauri::command]
pub fn search_files(root: String, query: String) -> Vec<SearchResult> {
    let query = query.trim().to_lowercase();
    if query.len() < 3 {
        return Vec::new();
    }

    let root_path = PathBuf::from(root);
    let root_canonical = match root_path.canonicalize() {
        Ok(canon) => canon,
        Err(_) => root_path.clone(),
    };

    let mut results = Vec::new();
    search_directory(&root_path, &root_canonical, &query, &mut results, MAX_SEARCH_RESULTS);
    results
}

fn search_directory(
    path: &Path,
    root_canonical: &Path,
    query: &str,
    results: &mut Vec<SearchResult>,
    max_results: usize,
) {
    if results.len() >= max_results {
        return;
    }

    if let Some(path_str) = path.to_str() {
        if path_str.starts_with("/proc")
            || path_str.starts_with("/sys")
            || path_str.starts_with("/dev")
            || path_str.starts_with("/run")
        {
            return;
        }
    }

    let entries = match fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        if results.len() >= max_results {
            break;
        }

        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };

        let path_buf = entry.path();

        if file_type.is_symlink() {
            continue;
        }

        let name = match path_buf.file_name() {
            Some(n) => n.to_string_lossy().to_string(),
            None => continue,
        };

        let is_directory = file_type.is_dir();

        if name.to_lowercase().contains(query) {
            results.push(SearchResult {
                name,
                path: path_buf.to_string_lossy().to_string(),
                is_directory,
            });
        }

        if results.len() >= max_results {
            break;
        }

        if is_directory {
            if let Ok(canonical_child) = path_buf.canonicalize() {
                if !canonical_child.starts_with(root_canonical) {
                    continue;
                }
            }

            search_directory(
                &path_buf,
                root_canonical,
                query,
                results,
                max_results,
            );
        }
    }
}
