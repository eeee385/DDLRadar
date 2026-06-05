use crate::error::AppError;
use crate::models::*;
use rusqlite::{params, Connection, Result};

// --- Schema ---

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS tasks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            course      TEXT NOT NULL,
            task_type   TEXT NOT NULL CHECK(task_type IN ('homework','exam','project','other')),
            deadline    TEXT NOT NULL,
            priority    TEXT NOT NULL CHECK(priority IN ('high','mid','low')),
            status      TEXT NOT NULL CHECK(status IN ('todo','doing','done')),
            description TEXT NOT NULL DEFAULT '',
            created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );",
    )
}

// --- Row mapping ---

fn row_to_task(row: &rusqlite::Row) -> Result<Task> {
    Ok(Task {
        id: row.get("id")?,
        title: row.get("title")?,
        course: row.get("course")?,
        task_type: parse_enum(row.get::<_, String>("task_type")?.as_str()),
        deadline: row.get("deadline")?,
        priority: parse_priority(row.get::<_, String>("priority")?.as_str()),
        status: parse_status(row.get::<_, String>("status")?.as_str()),
        description: row.get("description")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn parse_enum(s: &str) -> TaskType {
    match s {
        "homework" => TaskType::Homework,
        "exam" => TaskType::Exam,
        "project" => TaskType::Project,
        _ => TaskType::Other,
    }
}

fn parse_priority(s: &str) -> Priority {
    match s {
        "high" => Priority::High,
        "mid" => Priority::Mid,
        _ => Priority::Low,
    }
}

fn parse_status(s: &str) -> Status {
    match s {
        "doing" => Status::Doing,
        "done" => Status::Done,
        _ => Status::Todo,
    }
}

// --- CRUD ---

pub fn insert_task(conn: &Connection, req: &CreateTaskRequest) -> Result<Task> {
    conn.execute(
        "INSERT INTO tasks (title, course, task_type, deadline, priority, status, description)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            req.title,
            req.course,
            task_type_str(&req.task_type),
            req.deadline,
            priority_str(&req.priority),
            status_str(&req.status),
            req.description,
        ],
    )?;
    let id = conn.last_insert_rowid();
    find_task_by_id(conn, id).map(|t| t.unwrap())
}

pub fn find_task_by_id(conn: &Connection, id: i64) -> Result<Option<Task>> {
    let mut stmt = conn.prepare("SELECT * FROM tasks WHERE id = ?1")?;
    let mut rows = stmt.query_map(params![id], row_to_task)?;
    match rows.next() {
        Some(task) => task.map(Some),
        None => Ok(None),
    }
}

pub fn query_tasks(conn: &Connection, params: &TaskQueryParams) -> Result<Vec<Task>> {
    let mut sql = String::from("SELECT * FROM tasks WHERE 1=1");
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(ref s) = params.status {
        sql.push_str(" AND status = ?");
        bind_values.push(status_str(s).to_string());
    }
    if let Some(ref p) = params.priority {
        sql.push_str(" AND priority = ?");
        bind_values.push(priority_str(p).to_string());
    }
    if let Some(ref t) = params.task_type {
        sql.push_str(" AND task_type = ?");
        bind_values.push(task_type_str(t).to_string());
    }
    if let Some(ref q) = params.search {
        if !q.is_empty() {
            sql.push_str(" AND (title LIKE '%' || ? || '%' OR course LIKE '%' || ? || '%')");
            bind_values.push(q.clone());
            bind_values.push(q.clone());
        }
    }

    // Sort — whitelist to prevent SQL injection
    let sort_col = match params.sort_by.as_deref() {
        Some("deadline") => "deadline",
        Some("priority") => "priority",
        Some("created_at") => "created_at",
        Some("title") => "title",
        _ => "deadline",
    };
    let sort_dir = match params.sort_order.as_deref() {
        Some("desc") => "DESC",
        _ => "ASC",
    };
    sql.push_str(&format!(" ORDER BY {} {}", sort_col, sort_dir));

    let mut stmt = conn.prepare(&sql)?;
    let refs: Vec<&dyn rusqlite::types::ToSql> = bind_values
        .iter()
        .map(|v| v as &dyn rusqlite::types::ToSql)
        .collect();
    let rows = stmt.query_map(rusqlite::params_from_iter(refs), row_to_task)?;

    let mut tasks = Vec::new();
    for task in rows {
        tasks.push(task?);
    }
    Ok(tasks)
}

pub fn modify_task(conn: &Connection, id: i64, req: &UpdateTaskRequest) -> Result<Task, AppError> {
    let existing = find_task_by_id(conn, id)?
        .ok_or_else(|| AppError::NotFound(format!("Task with id {} not found", id)))?;

    let title = req.title.as_ref().unwrap_or(&existing.title);
    let course = req.course.as_ref().unwrap_or(&existing.course);
    let task_type = req.task_type.as_ref().unwrap_or(&existing.task_type);
    let deadline = req.deadline.as_ref().unwrap_or(&existing.deadline);
    let priority = req.priority.as_ref().unwrap_or(&existing.priority);
    let status = req.status.as_ref().unwrap_or(&existing.status);
    let description = req.description.as_ref().unwrap_or(&existing.description);

    conn.execute(
        "UPDATE tasks SET title=?1, course=?2, task_type=?3, deadline=?4, priority=?5,
         status=?6, description=?7, updated_at=datetime('now','localtime') WHERE id=?8",
        params![
            title,
            course,
            task_type_str(task_type),
            deadline,
            priority_str(priority),
            status_str(status),
            description,
            id,
        ],
    )?;

    Ok(find_task_by_id(conn, id)?.unwrap())
}

pub fn remove_task(conn: &Connection, id: i64) -> Result<bool> {
    let affected = conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

// --- Dashboard helpers ---

pub fn count_tasks_by_status(conn: &Connection) -> Result<(i64, i64, i64, i64)> {
    let total: i64 = conn.query_row("SELECT COUNT(*) FROM tasks", [], |r| r.get(0))?;
    let todo_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE status = 'todo'",
        [],
        |r| r.get(0),
    )?;
    let doing_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE status = 'doing'",
        [],
        |r| r.get(0),
    )?;
    let done_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE status = 'done'",
        [],
        |r| r.get(0),
    )?;
    Ok((total, todo_count, doing_count, done_count))
}

pub fn get_non_done_tasks(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare("SELECT * FROM tasks WHERE status != 'done'")?;
    let rows = stmt.query_map([], row_to_task)?;
    let mut tasks = Vec::new();
    for task in rows {
        tasks.push(task?);
    }
    Ok(tasks)
}

// --- Enum serialization helpers ---

fn task_type_str(val: &TaskType) -> &'static str {
    match val {
        TaskType::Homework => "homework",
        TaskType::Exam => "exam",
        TaskType::Project => "project",
        TaskType::Other => "other",
    }
}

fn priority_str(val: &Priority) -> &'static str {
    match val {
        Priority::High => "high",
        Priority::Mid => "mid",
        Priority::Low => "low",
    }
}

fn status_str(val: &Status) -> &'static str {
    match val {
        Status::Todo => "todo",
        Status::Doing => "doing",
        Status::Done => "done",
    }
}
