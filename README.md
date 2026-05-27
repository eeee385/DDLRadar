# DDLRadar

面向学生的课程 DDL（Deadline）管理系统，支持任务 CRUD、风险等级自动计算、Dashboard 看板和 AI 辅助建议。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端语言 | Rust (edition 2021) |
| Web 框架 | Axum 0.7 |
| 异步运行时 | Tokio 1 |
| 数据库 | SQLite（通过 rusqlite 0.31，bundled 模式无需额外安装） |
| 时间处理 | Chrono 0.4 |
| JSON 序列化 | Serde / Serde JSON |
| CORS | tower-http 0.5 |
| 日志 | tracing / tracing-subscriber |

## 快速启动

### 环境要求

- Rust 工具链（[rustup](https://rustup.rs/) 安装）：`rustc >= 1.75`
- 无需安装 SQLite（`rusqlite` 的 `bundled` feature 会从源码编译 SQLite）

### 运行

```bash
# 进入项目目录
cd DDLradar

# 编译并运行（首次需下载依赖，约 2-3 分钟）
cargo run

# 服务启动后监听在 http://localhost:3000
```

启动后会在项目根目录自动创建 `ddlradar.db`（SQLite 数据库文件）。

### 快速验证

```bash
# 健康检查
curl http://localhost:3000/api/health

# 创建一个任务
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"软件工程大作业","course":"软件工程","task_type":"project","deadline":"2026-06-20 23:59","priority":"high","description":"完成 DDLRadar 项目"}'

# 查看所有任务
curl http://localhost:3000/api/tasks

# 查看 Dashboard
curl http://localhost:3000/api/dashboard

# 获取 AI 建议
curl -X POST http://localhost:3000/api/ai/suggest \
  -H "Content-Type: application/json" \
  -d '{"title":"软件工程大作业","course":"软件工程","task_type":"project","deadline":"2026-06-20 23:59","priority":"high","status":"todo","description":"完成 DDLRadar 项目"}'
```

---

## 项目结构

```
DDLradar/
├── Cargo.toml                # 依赖配置
├── README.md                 # 本文件
├── ddlradar.db               # SQLite 数据库文件（cargo run 后自动生成）
└── src/
    ├── main.rs               # 入口：服务启动、路由注册、CORS、State 注入
    ├── state.rs              # AppState 定义（共享的 DB 连接 + AI advisor）
    ├── models.rs             # 所有数据类型：Task、枚举、请求体、响应体
    ├── db.rs                 # 数据库层：建表、CRUD、统计查询
    ├── error.rs              # 统一错误类型 AppError → JSON 响应
    ├── risk.rs               # 风险计算模块（当前为 stub，待角色 C 实现）
    ├── ai/
    │   ├── mod.rs            # AiAdvisor trait 定义 + AiTaskInfo 结构体
    │   └── mock.rs           # Mock AI 实现（返回模板化建议）
    └── handlers/
        ├── mod.rs            # 模块重导出
        ├── health.rs         # GET /api/health
        ├── tasks.rs          # GET/POST/PUT/DELETE /api/tasks
        ├── dashboard.rs      # GET /api/dashboard
        └── ai.rs             # POST /api/ai/suggest
```

---

## 数据库设计

### 表结构：`tasks`

```sql
CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,            -- 任务名称
    course      TEXT NOT NULL,            -- 所属课程
    task_type   TEXT NOT NULL             -- 任务类型
                    CHECK(task_type IN ('homework','exam','project','other')),
    deadline    TEXT NOT NULL,            -- 截止时间，格式 "YYYY-MM-DD HH:MM"
    priority    TEXT NOT NULL             -- 优先级
                    CHECK(priority IN ('high','mid','low')),
    status      TEXT NOT NULL             -- 状态
                    CHECK(status IN ('todo','doing','done')),
    description TEXT NOT NULL DEFAULT '', -- 任务描述
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
```

**注意**：`risk_level`（风险等级）不存储在数据库中，由后端运行时计算。

---

## API 文档

所有接口统一响应格式：

```json
// 成功
{ "success": true, "message": "描述信息", "data": { ... } }

// 失败
{ "success": false, "message": "错误描述", "data": null }
```

### 1. 健康检查

```
GET /api/health
```

**响应示例**：
```json
{ "success": true, "message": "Service is running" }
```

---

### 2. 获取任务列表

```
GET /api/tasks
```

**查询参数**（均为可选）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `status` | string | 按状态筛选：`todo` / `doing` / `done` |
| `priority` | string | 按优先级筛选：`high` / `mid` / `low` |
| `task_type` | string | 按类型筛选：`homework` / `exam` / `project` / `other` |
| `sort_by` | string | 排序字段：`deadline`（默认）/ `priority` / `created_at` / `title` |
| `sort_order` | string | 排序方向：`asc`（默认）/ `desc` |
| `search` | string | 在标题和课程名中模糊搜索 |

**示例**：
```
GET /api/tasks?status=todo&sort_by=deadline&sort_order=asc
GET /api/tasks?search=软件工程
```

**响应示例**：
```json
{
  "success": true,
  "message": "Tasks retrieved",
  "data": [
    {
      "id": 1,
      "title": "软件工程大作业",
      "course": "软件工程",
      "task_type": "project",
      "deadline": "2026-06-20 23:59",
      "priority": "high",
      "status": "todo",
      "description": "完成 DDLRadar 项目",
      "created_at": "2026-05-27 14:30:00",
      "updated_at": "2026-05-27 14:30:00",
      "risk_level": "低风险",
      "is_overdue": false
    }
  ]
}
```

---

### 3. 创建任务

```
POST /api/tasks
```

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 任务名称 |
| `course` | string | 是 | 所属课程 |
| `task_type` | string | 是 | `homework` / `exam` / `project` / `other` |
| `deadline` | string | 是 | 截止时间，格式 `YYYY-MM-DD HH:MM` |
| `priority` | string | 是 | `high` / `mid` / `low` |
| `status` | string | 否 | `todo`（默认）/ `doing` / `done` |
| `description` | string | 否 | 任务详情描述，默认为空字符串 |

**请求示例**：
```json
{
  "title": "软件工程大作业",
  "course": "软件工程",
  "task_type": "project",
  "deadline": "2026-06-20 23:59",
  "priority": "high",
  "status": "todo",
  "description": "完成 DDLRadar 项目"
}
```

**响应**：HTTP 201，返回创建的任务完整数据。

---

### 4. 更新任务

```
PUT /api/tasks/:id
```

路径参数 `:id` 为任务 ID。

**请求体中所有字段均为可选**，只传需要修改的字段即可，未传字段保持原值。

**请求示例**（仅修改状态）：
```json
{ "status": "doing" }
```

**响应**：返回更新后的完整任务数据。

**错误**：若 ID 不存在返回 404：
```json
{ "success": false, "message": "Task with id 999 not found", "data": null }
```

---

### 5. 删除任务

```
DELETE /api/tasks/:id
```

**响应**：
```json
{ "success": true, "message": "Task deleted successfully" }
```

**错误**：若 ID 不存在返回 404。

---

### 6. Dashboard 统计

```
GET /api/dashboard
```

**响应示例**：
```json
{
  "success": true,
  "message": "Dashboard data retrieved",
  "data": {
    "total_tasks": 12,
    "todo_tasks": 7,
    "doing_tasks": 3,
    "done_tasks": 2,
    "overdue_tasks": 1,
    "high_risk_tasks": 4
  }
}
```

---

### 7. AI 建议

```
POST /api/ai/suggest
```

**请求体**：与创建任务结构一致（可只传 AI 分析所需的字段）：

```json
{
  "title": "软件工程大作业",
  "course": "软件工程",
  "task_type": "project",
  "deadline": "2026-06-20 23:59",
  "priority": "high",
  "status": "todo",
  "description": "完成 DDLRadar 项目"
}
```

**响应示例**（Mock 模式）：
```json
{
  "success": true,
  "message": "AI suggestion generated",
  "data": {
    "advice": "针对「软件工程大作业」课程项目，建议按以下步骤推进：\n1. 需求分析与方案设计\n2. 数据库/接口设计\n3. 核心功能实现\n4. 测试与文档整理\n5. 答辩准备"
  }
}
```

---

## 枚举值速查表

### task_type（任务类型）

| 数据库值 | JSON 值 | 含义 |
|----------|---------|------|
| `homework` | `"homework"` | 作业 |
| `exam` | `"exam"` | 考试 |
| `project` | `"project"` | 课程项目 |
| `other` | `"other"` | 其他任务 |

### priority（优先级）

| 数据库值 | JSON 值 | 含义 |
|----------|---------|------|
| `high` | `"high"` | 高 |
| `mid` | `"mid"` | 中 |
| `low` | `"low"` | 低 |

### status（状态）

| 数据库值 | JSON 值 | 含义 |
|----------|---------|------|
| `todo` | `"todo"` | 未开始 |
| `doing` | `"doing"` | 进行中 |
| `done` | `"done"` | 已完成 |

---

## 各角色对接说明

### 角色 A（项目统筹 / 文档）

- 数据模型定义在 `src/models.rs`，所有类型均含 Serde 序列化标注
- API 接口已在 README 列出，可直接用于编写设计文档
- 风险等级计算规则见 `需求文档.md` 第 4.3 节，对应代码在 `src/risk.rs`

### 角色 C（风险计算 / AI 模块）

**风险计算对接**：
- 文件：`src/risk.rs`
- 当前为 stub 实现（所有未完成任务返回"低风险"），函数签名已确定：
  ```rust
  pub fn calculate_risk(
      deadline: &str,        // "2026-06-20 23:59"
      priority: &Priority,
      status: &Status,
      now: NaiveDateTime,
  ) -> RiskInfo              // { risk_level: String, is_overdue: bool }
  ```
- **替换此文件内容即可，无需修改其他任何代码**
- 风险等级标签应与 Dashboard 中的判断字符串一致：`"已完成"`、`"已逾期"`、`"高风险"`、`"中风险"`、`"低风险"`

**AI 模块对接**：
- 文件：`src/ai/mod.rs`（trait 定义）、`src/ai/mock.rs`（Mock 实现）
- `AiAdvisor` trait：
  ```rust
  pub trait AiAdvisor: Send + Sync {
      fn generate_advice(&self, task_info: &AiTaskInfo) -> Result<String, AiError>;
  }
  ```
- 如需接入真实 API：
  1. 新增文件 `src/ai/real.rs`，实现 `AiAdvisor` trait
  2. 在 `src/main.rs` 第 24 行将 `MockAiAdvisor` 替换为真实实现
  3. Mock 模式建议保留，可在初始化时使用 `match` 做模式切换

### 角色 D（前端 / 测试）

- 后端默认监听 `http://localhost:3000`，CORS 已全开，前端可用 `fetch` 直接调用
- 所有接口返回统一 JSON 格式 `{ success, message, data }`
- 前端需要展示的 `risk_level` 在任务列表和 Dashboard 响应中已包含
- `task_type`/`priority`/`status` 枚举值均为小写英文字符串（见上方速查表）
- 测试数据示例见快速验证一节

### 前端 HTML 页面嵌入方式

只需在项目根目录的 `static/` 目录放置 HTML/CSS/JS 文件，由前端同学自行决定如何托管。两种方案：

**方案 A（推荐）**：后端托管静态文件。在 `main.rs` 中添加：
```rust
.use(axum::routing::get_service(
    tower_http::services::ServeDir::new("static")
).handle_error(|e| async move { ... }),)
```

**方案 B**：前端独立启动（如 VS Code Live Server），通过 CORS 跨域调用后端 API。

---

## 常见问题

**Q: 启动时报错 "Address already in use"？**
A: 端口 3000 被占用。修改 `src/main.rs` 中的 `0.0.0.0:3000` 为其他端口，或关闭占用进程。

**Q: 中文 JSON 显示乱码？**
A: Windows 终端默认编码可能不是 UTF-8。在终端执行 `chcp 65001` 切换到 UTF-8 编码。后端本身正确处理 UTF-8。

**Q: 数据库文件在哪里？**
A: 项目根目录的 `ddlradar.db`。删除此文件即可重置所有数据。

**Q: 如何修改端口？**
A: 编辑 `src/main.rs` 第 56 行的 `"0.0.0.0:3000"` 改为目标端口。

---


