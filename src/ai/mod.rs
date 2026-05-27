mod mock;
pub use mock::MockAiAdvisor;

use serde::{Deserialize, Serialize};
use crate::models::{Priority, Status, TaskType};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiTaskInfo {
    pub title: String,
    pub course: String,
    pub task_type: TaskType,
    pub deadline: String,
    pub priority: Priority,
    pub status: Status,
    pub description: String,
}

#[derive(Debug)]
pub struct AiError(pub String);

pub trait AiAdvisor: Send + Sync {
    fn generate_advice(&self, task_info: &AiTaskInfo) -> Result<String, AiError>;
}
