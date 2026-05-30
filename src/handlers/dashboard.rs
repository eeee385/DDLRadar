use axum::extract::State;
use axum::Json;

use crate::db;
use crate::error::AppError;
use crate::models::{ApiResponse, DashboardResponse};
use crate::risk;
use crate::state::AppState;

pub async fn dashboard(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<DashboardResponse>>, AppError> {
    let (non_done_tasks, total, todo_count, doing_count, done_count) =
        tokio::task::spawn_blocking(move || {
            let conn = state.db.lock().unwrap();
            let non_done = db::get_non_done_tasks(&conn)?;
            let counts = db::count_tasks_by_status(&conn)?;
            Ok::<_, AppError>((non_done, counts.0, counts.1, counts.2, counts.3))
        })
        .await??;

    let now = chrono::Local::now().naive_local();
    let mut overdue_count = 0i64;
    let mut high_risk_count = 0i64;

    for task in &non_done_tasks {
        let risk_info = risk::calculate_risk(&task.deadline, &task.priority, &task.status, now);
        if risk_info.is_overdue {
            overdue_count += 1;
        }
        if risk_info.risk_level == "高风险" || risk_info.risk_level == "已逾期" {
            high_risk_count += 1;
        }
    }

    let response = DashboardResponse {
        total_tasks: total,
        todo_tasks: todo_count,
        doing_tasks: doing_count,
        done_tasks: done_count,
        overdue_tasks: overdue_count,
        high_risk_tasks: high_risk_count,
    };

    Ok(Json(ApiResponse::success(
        "Dashboard data retrieved",
        response,
    )))
}
