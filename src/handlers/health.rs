use crate::models::ApiResponse;
use axum::Json;

pub async fn health_check() -> Json<ApiResponse<()>> {
    Json(ApiResponse::<()>::success_no_data("Service is running"))
}
