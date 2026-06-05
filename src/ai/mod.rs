mod mock;
mod llm;
pub use mock::MockAiAdvisor;
pub use llm::LLMAiAdvisor;

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
        _api_key: &str,
        _api_base: &str,
        _0model: &str,
        task_info: &AiTaskInfo
    ) -> Result<String, AiError>;

    fn generate_weekly_summary(
        &self,
        _api_key: &str,
        _api_base: &str,
        _model: &str,
        tasks: &[crate::models::TaskWithRisk]
    ) -> Result<String, AiError>;
}
