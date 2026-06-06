use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::ai::LLMConfig;
use crate::error::AppError;
use crate::models::ApiResponse;
use crate::state::AppState;
use secrecy::SecretString;

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

/// GET /api/config — 返回当前 AI 模式信息（不含 API Key）
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

/// POST /api/config — 运行时更新 LLM 配置或重置为 Mock
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
