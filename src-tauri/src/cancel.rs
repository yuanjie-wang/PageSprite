use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::watch;

/// Shared cancellation manager for in-progress generations.
/// Each task registers a `watch::Sender<bool>` under its ID.
/// `cancel(id)` sends `true` to abort the task.
#[derive(Clone)]
pub struct CancelManager {
    signals: Arc<Mutex<HashMap<String, watch::Sender<bool>>>>,
}

impl CancelManager {
    pub fn new() -> Self {
        Self {
            signals: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register a cancel signal for the given ID. Returns a receiver.
    pub fn register(&self, id: String) -> watch::Receiver<bool> {
        let (tx, rx) = watch::channel(false);
        self.signals.lock().unwrap().insert(id, tx);
        rx
    }

    /// Cancel the task with the given ID. Returns true if a task was found.
    pub fn cancel(&self, id: &str) -> bool {
        if let Some(tx) = self.signals.lock().unwrap().remove(id) {
            let _ = tx.send(true);
            true
        } else {
            false
        }
    }

    /// Remove the cancel signal without cancelling (called on normal completion).
    pub fn unregister(&self, id: &str) {
        self.signals.lock().unwrap().remove(id);
    }
}

#[tauri::command]
pub fn cancel_generation(id: String, mgr: tauri::State<'_, CancelManager>) -> Result<(), String> {
    if mgr.cancel(&id) {
        eprintln!("[cancel] {id} cancelled");
    } else {
        eprintln!("[cancel] {id}: no active task found");
    }
    Ok(())
}
