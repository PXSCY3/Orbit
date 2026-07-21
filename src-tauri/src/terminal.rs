use tauri::Emitter;

use portable_pty::{
    native_pty_system,
    CommandBuilder,
    PtySize,
};

use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};

use serde::Serialize;

static NEXT_SESSION: AtomicUsize = AtomicUsize::new(1);

fn next_session_id() -> String {
    let n = NEXT_SESSION.fetch_add(1, Ordering::Relaxed);
    format!("s-{}", n)
}

pub struct TerminalState {
    pub writers: Arc<Mutex<HashMap<String, Box<dyn Write + Send>>>>,
    pub owners: Arc<Mutex<HashMap<String, String>>>, // session_id -> window_label
}

#[derive(Serialize, Clone)]
struct TerminalOutput {
    id: String,
    payload: String,
}

#[tauri::command]
pub fn start_terminal(
    window: tauri::Window,
    app: tauri::AppHandle,
    state: tauri::State<TerminalState>,
) -> Result<String, String> {

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 30,
            cols: 100,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = std::env::var("SHELL").unwrap_or("/bin/bash".into());

    let mut cmd_builder = CommandBuilder::new(shell);
    cmd_builder.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd_builder).map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let session_id = next_session_id();

    let owner = window.label().to_string();
    state
        .writers
        .lock()
        .unwrap()
        .insert(session_id.clone(), writer);
    state
        .owners
        .lock()
        .unwrap()
        .insert(session_id.clone(), owner.clone());

    // spawn reader thread
    let thread_session = session_id.clone();
    std::thread::spawn(move || {
        let _child = child;
        let mut buffer = [0u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(size) if size > 0 => {
                    let output = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ = app.emit_to(&owner, "terminal-output", TerminalOutput { id: thread_session.clone(), payload: output });
                }
                _ => break,
            }
        }
    });

    Ok(session_id)
}


#[tauri::command]
pub fn write_terminal(
    session: String,
    input: String,
    window: tauri::Window,
    state: tauri::State<TerminalState>,
) -> Result<(), String> {

    // ensure caller owns the session
    let caller = window.label();
    let owners = state.owners.lock().unwrap();
    match owners.get(&session) {
        Some(owner) if owner == &caller => {
            drop(owners);
            let mut writers = state.writers.lock().unwrap();
            match writers.get_mut(&session) {
                Some(writer) => {
                    writer.write_all(input.as_bytes()).map_err(|e| e.to_string())?;
                    writer.flush().map_err(|e| e.to_string())?;
                    Ok(())
                }
                None => Err("Session not found".into()),
            }
        }
        _ => Err("Not authorized for session".into()),
    }
}

#[tauri::command]
pub fn close_terminal(session: String, window: tauri::Window, state: tauri::State<TerminalState>) -> Result<(), String> {
    // only allow owner to close
    let caller = window.label();
    let mut owners = state.owners.lock().unwrap();
    match owners.get(&session) {
        Some(owner) if owner == &caller => {
            owners.remove(&session);
            drop(owners);
            let mut writers = state.writers.lock().unwrap();
            writers.remove(&session);
            Ok(())
        }
        _ => Err("Not authorized to close session".into()),
    }
}