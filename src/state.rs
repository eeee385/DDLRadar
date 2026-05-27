use rusqlite::Connection;
use std::sync::{Arc, Mutex};

use crate::ai::AiAdvisor;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub ai_advisor: Arc<dyn AiAdvisor>,
}
