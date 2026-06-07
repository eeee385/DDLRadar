mod mock;
mod llm;
pub mod utils;
pub use mock::MockAiAdvisor;
pub use llm::{LLMAiAdvisor, LLMConfig};

use crate::models::{Priority, Status, TaskType};
use serde::{Deserialize, Serialize};

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
    fn generate_advice(
        &self,
        task_info: &AiTaskInfo
    ) -> Result<String, AiError>;

    fn generate_weekly_summary(
        &self,
        tasks: &[crate::models::TaskWithRisk]
    ) -> Result<String, AiError>;
}
