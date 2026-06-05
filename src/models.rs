use serde::{Deserialize, Serialize};

// --- Enums ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskType {
    Homework,
    Exam,
    Project,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    High,
    Mid,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Todo,
    Doing,
    Done,
}

// --- DB Entity ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub course: String,
    pub task_type: TaskType,
    pub deadline: String,
    pub priority: Priority,
    pub status: Status,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

// --- API Request Types ---

#[derive(Debug, Deserialize)]
pub struct CreateTaskRequest {
    pub title: String,
    pub course: String,
    pub task_type: TaskType,
    pub deadline: String,
    pub priority: Priority,
    #[serde(default = "default_status")]
    pub status: Status,
    #[serde(default)]
    pub description: String,
}

fn default_status() -> Status {
    Status::Todo
}

#[derive(Debug, Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub course: Option<String>,
    pub task_type: Option<TaskType>,
    pub deadline: Option<String>,
    pub priority: Option<Priority>,
    pub status: Option<Status>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TaskQueryParams {
    pub status: Option<Status>,
    pub priority: Option<Priority>,
    pub task_type: Option<TaskType>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub search: Option<String>,
}

// --- API Response Types ---

#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(message: impl Into<String>, data: T) -> Self {
        Self {
            success: true,
            message: message.into(),
            data: Some(data),
        }
    }

    pub fn success_no_data(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: message.into(),
            data: None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TaskWithRisk {
    #[serde(flatten)]
    pub task: Task,
    pub risk_level: String,
    pub is_overdue: bool,
}

#[derive(Debug, Serialize)]
pub struct DashboardResponse {
    pub total_tasks: i64,
    pub todo_tasks: i64,
    pub doing_tasks: i64,
    pub done_tasks: i64,
    pub overdue_tasks: i64,
    pub high_risk_tasks: i64,
}

#[derive(Debug, Serialize)]
pub struct AiSuggestResponse {
    pub advice: String,
}
