use axum::extract::State;
use axum::Json;

use crate::ai::AiTaskInfo;
use crate::error::AppError;
use crate::models::{AiSuggestResponse, ApiResponse};
use crate::state::AppState;

pub async fn ai_suggest(
    State(state): State<AppState>,
    Json(task_info): Json<AiTaskInfo>,
) -> Result<Json<ApiResponse<AiSuggestResponse>>, AppError> {
    let advice = state
        .ai_advisor
        .generate_advice(" "," "," ",&task_info)
        .map_err(|e| AppError::Internal(format!("AI error: {}", e.0)))?;

    Ok(Json(ApiResponse::success(
        "AI suggestion generated",
        AiSuggestResponse { advice },
    )))
}
