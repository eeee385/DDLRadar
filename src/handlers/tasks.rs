use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;

use crate::db;
use crate::error::AppError;
use crate::models::*;
use crate::risk;
use crate::state::AppState;

pub async fn list_tasks(
    State(state): State<AppState>,
    Query(params): Query<TaskQueryParams>,
) -> Result<Json<ApiResponse<Vec<TaskWithRisk>>>, AppError> {
    let tasks = tokio::task::spawn_blocking(move || {
        let conn = state.db.lock().unwrap();
        db::query_tasks(&conn, &params)
    })
    .await??;

    let now = chrono::Local::now().naive_local();
    let tasks_with_risk: Vec<TaskWithRisk> = tasks
        .into_iter()
        .map(|task| {
            let risk_info =
                risk::calculate_risk(&task.deadline, &task.priority, &task.status, now);
            TaskWithRisk {
                task,
                risk_level: risk_info.risk_level,
                is_overdue: risk_info.is_overdue,
            }
        })
        .collect();

    Ok(Json(ApiResponse::success(
        "Tasks retrieved",
        tasks_with_risk,
    )))
}

pub async fn create_task(
    State(state): State<AppState>,
    Json(req): Json<CreateTaskRequest>,
) -> Result<(StatusCode, Json<ApiResponse<Task>>), AppError> {
    let task = tokio::task::spawn_blocking(move || {
        let conn = state.db.lock().unwrap();
        db::insert_task(&conn, &req)
    })
    .await??;

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success("Task created successfully", task)),
    ))
}

pub async fn update_task(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(req): Json<UpdateTaskRequest>,
) -> Result<Json<ApiResponse<Task>>, AppError> {
    let task = tokio::task::spawn_blocking(move || {
        let conn = state.db.lock().unwrap();
        db::modify_task(&conn, id, &req)
    })
    .await??;

    Ok(Json(ApiResponse::success("Task updated successfully", task)))
}

pub async fn delete_task(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    let deleted = tokio::task::spawn_blocking(move || {
        let conn = state.db.lock().unwrap();
        db::remove_task(&conn, id)
    })
    .await??;

    if deleted {
        Ok(Json(ApiResponse::<()>::success_no_data(
            "Task deleted successfully",
        )))
    } else {
        Err(AppError::NotFound(format!(
            "Task with id {} not found",
            id
        )))
    }
}
