mod ai;
mod db;
mod error;
mod handlers;
mod models;
mod risk;
mod state;
mod utils;

use axum::routing::{get, post, put};
use axum::Router;
use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tower_http::cors::{Any, CorsLayer};

use state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    // Initialize database
    let conn = Connection::open("ddlradar.db")?;
    db::init_db(&conn)?;
    let db_pool = Arc::new(Mutex::new(conn));

    // Initialize AI advisors
    let llm_api_key = std::env::var("LLM_API_KEY").unwrap_or_default();
    let llm_api_base = std::env::var("LLM_API_BASE").unwrap_or_default();
    let llm_model = std::env::var("LLM_MODEL").unwrap_or_default();

    let ai_advisor: Arc<dyn ai::AiAdvisor> = Arc::new(ai::MockAiAdvisor);

    let llm_config = if !llm_api_key.is_empty() {
        Some(ai::LLMConfig {
            api_key: secrecy::SecretString::from(llm_api_key),
            api_base: llm_api_base,
            model: llm_model,
        })
    } else {
        None
    };
    let llm_advisor = Arc::new(ai::LLMAiAdvisor::new(llm_config));

    let state = AppState {
        db: db_pool,
        ai_advisor,
        llm_advisor,
    };

    // CORS — permissive for development
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Router
    let app = Router::new()
        .route("/api/health", get(handlers::health::health_check))
        .route(
            "/api/tasks",
            get(handlers::tasks::list_tasks).post(handlers::tasks::create_task),
        )
        .route(
            "/api/tasks/:id",
            put(handlers::tasks::update_task).delete(handlers::tasks::delete_task),
        )
        .route("/api/dashboard", get(handlers::dashboard::dashboard))
        .route("/api/ai/suggest", post(handlers::ai::ai_suggest))
        .route("/api/ai/weekly", post(handlers::ai::weekly_summary))
        .route(
            "/api/config",
            get(handlers::config::get_config).post(handlers::config::update_config),
        )
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("DDLRadar server running on http://localhost:3000");
    axum::serve(listener, app).await?;

    Ok(())
}
