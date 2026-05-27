use axum::Json;
use crate::models::ApiResponse;

pub async fn health_check() -> Json<ApiResponse<()>> {
    Json(ApiResponse::<()>::success_no_data("Service is running"))
}
