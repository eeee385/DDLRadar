use rusqlite::Connection;
use std::sync::{Arc, Mutex};

use crate::ai::{AiAdvisor, LLMAiAdvisor};

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub ai_advisor: Arc<dyn AiAdvisor>, // Mock，作为降级兜底
    pub llm_advisor: Arc<LLMAiAdvisor>, // LLM（API Key 封装在内部）
}
