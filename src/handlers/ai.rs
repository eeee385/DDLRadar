use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::ai::{AiAdvisor, AiTaskInfo, LLMConfig};
use crate::db;
use crate::error::AppError;
use crate::models::{AiSuggestResponse, ApiResponse, TaskWithRisk};
use crate::risk;
use crate::state::AppState;
use secrecy::SecretString;

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
    // 提前 clone 所需字段，避免 spawn_blocking move 掉整个 state
    let db = state.db.clone();
    let llm_advisor = state.llm_advisor.clone();
    let ai_advisor = state.ai_advisor.clone();

    let tasks_with_risk: Vec<TaskWithRisk> = tokio::task::spawn_blocking(move || {
        let conn = db.lock().unwrap();
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

    let summary = if llm_advisor.is_configured() {
        llm_advisor
            .generate_weekly_summary(&tasks_with_risk)
            .unwrap_or_else(|_| {
                // LLM 调用失败，降级到 Mock
                ai_advisor
                    .generate_weekly_summary(&tasks_with_risk)
                    .unwrap_or_else(|e| format!("AI 服务暂不可用: {}", e.0))
            })
    } else {
        // 未配置 LLM，直接使用 Mock
        ai_advisor
            .generate_weekly_summary(&tasks_with_risk)
            .map_err(|e| AppError::Internal(format!("AI error: {}", e.0)))?
    };

    Ok(Json(ApiResponse::success(
        "Weekly summary generated",
        AiSuggestResponse { advice: summary },
    )))
}

// --- AI 配置接口 ---

#[derive(Debug, Serialize)]
pub struct ConfigResponse {
    pub configured: bool,
    pub api_base: String,
    pub model: String,
}

#[derive(Debug, Deserialize)]
pub struct ConfigUpdateRequest {
    pub api_key: String,
    #[serde(default)]
    pub api_base: String,
    #[serde(default)]
    pub model: String,
}

/// GET /api/ai/config — 返回当前 AI 模式信息（不含 API Key）
pub async fn get_config(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<ConfigResponse>>, AppError> {
    let info = state.llm_advisor.config_info();
    let (configured, api_base, model) = if let Some((base, m)) = info {
        (true, base, m)
    } else {
        (false, String::new(), String::new())
    };

    Ok(Json(ApiResponse::success(
        "ok",
        ConfigResponse {
            configured,
            api_base,
            model,
        },
    )))
}

/// POST /api/ai/config — 运行时更新 LLM 配置或重置为 Mock
pub async fn update_config(
    State(state): State<AppState>,
    Json(req): Json<ConfigUpdateRequest>,
) -> Result<Json<ApiResponse<Option<()>>>, AppError> {
    if req.api_key.trim().is_empty() {
        // 重置为 Mock
        state.llm_advisor.update_config(None);
        Ok(Json(ApiResponse::success_no_data("已重置为 Mock 模式")))
    } else {
        // 更新 LLM 配置
        state.llm_advisor.update_config(Some(LLMConfig {
            api_key: SecretString::from(req.api_key),
            api_base: req.api_base,
            model: req.model,
        }));
        Ok(Json(ApiResponse::success_no_data("LLM 配置已保存")))
    }
}
