use axum::extract::State;
use axum::Json;

use crate::ai::{AiAdvisor, AiTaskInfo};
use crate::db;
use crate::error::AppError;
use crate::models::{AiSuggestResponse, ApiResponse, TaskWithRisk};
use crate::risk;
use crate::state::AppState;

/// 单任务 AI 建议：优先尝试 LLM，失败则降级到 Mock
pub async fn ai_suggest(
    State(state): State<AppState>,
    Json(task_info): Json<AiTaskInfo>,
) -> Result<Json<ApiResponse<AiSuggestResponse>>, AppError> {
    let advice = if state.llm_advisor.is_configured() {
        state
            .llm_advisor
            .generate_advice(&task_info)
            .unwrap_or_else(|_| {
                // LLM 调用失败，降级到 Mock
                state
                    .ai_advisor
                    .generate_advice(&task_info)
                    .unwrap_or_else(|e| format!("AI 服务暂不可用: {}", e.0))
            })
    } else {
        // 未配置 LLM，直接使用 Mock
        state
            .ai_advisor
            .generate_advice(&task_info)
            .map_err(|e| AppError::Internal(format!("AI error: {}", e.0)))?
    };

    Ok(Json(ApiResponse::success(
        "AI suggestion generated",
        AiSuggestResponse { advice },
    )))
}

/// 周总结：获取未来 7 天非完成任务，优先 LLM，失败降级 Mock
pub async fn weekly_summary(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<AiSuggestResponse>>, AppError> {
    // 从数据库获取非完成任务并计算风险
    let tasks_with_risk: Vec<TaskWithRisk> = tokio::task::spawn_blocking(move || {
        let conn = state.db.lock().unwrap();
        let non_done = db::get_non_done_tasks(&conn)
            .map_err(|e| AppError::Database(e))?;
        let now = chrono::Local::now().naive_local();
        let mut result = Vec::new();
        for task in non_done {
            let risk_info = risk::calculate_risk(&task.deadline, &task.priority, &task.status, now);
            result.push(TaskWithRisk {
                task,
                risk_level: risk_info.risk_level,
                is_overdue: risk_info.is_overdue,
            });
        }
        Ok::<_, AppError>(result)
    })
    .await??;

    let summary = if state.llm_advisor.is_configured() {
        state
            .llm_advisor
            .generate_weekly_summary(&tasks_with_risk)
            .unwrap_or_else(|_| {
                // LLM 调用失败，降级到 Mock
                state
                    .ai_advisor
                    .generate_weekly_summary(&tasks_with_risk)
                    .unwrap_or_else(|e| format!("AI 服务暂不可用: {}", e.0))
            })
    } else {
        // 未配置 LLM，直接使用 Mock
        state
            .ai_advisor
            .generate_weekly_summary(&tasks_with_risk)
            .map_err(|e| AppError::Internal(format!("AI error: {}", e.0)))?
    };

    Ok(Json(ApiResponse::success(
        "Weekly summary generated",
        AiSuggestResponse { advice: summary },
    )))
}
