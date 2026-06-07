# role C 新增项：
### 2026/6/4 23:36
- src/ai/mod.rs 新增周总结方法
- src/models.rs Status枚举类型新增项Overdue，表示逾期状态

### 2026/6/5 9:32
- utils.rs 新增工具包文件
- main.rs 新增声明 mod utils
- ai/mock.rs 新增单元测试
- ai/mod.rs 新增考试建议方法generate_exam_advice，以求更加合理的建议
- db.rs status_str方法中新增对于Overdue的处理
- llm.rs 暂未实现

### 2026/6/5 16:57
- 删除了Status枚举类型的新增项Overdue
- 删除了db.rs的status_str方法中新增对于Overdue的处理
- 修改了estimate_available_days方法，现在它在发现逾期时会返回-1
- 修改了mock风格建议对于逾期事件的处理方式

### 2026/6/5 16:57
- ai/mod.rs 修改了函数参数以及其相关实现
- 新增对于mock的单元测试，测试对象为generate_weekly_summary
- handlers/ai.rs 同步修改了相关的函数参数
- 实现了 llm.rs，并添加若干单元测试
- cargo add ureq 

### 2026/6/6 22:19
- 调整了ai模块的实现，将LLM相关的llm_api、llm_base、model嵌入到LLMAiAdvisor内部，并对llm_api做了加密处理，删除了函数签名中的api等字段。
- 修改了handlers中对于ai的接口调用方式，新的调用方式实现了LLM建议、周总结、LLM转MOCK等功能。
- 在state.rs中添加了llm字段。
- 在main.rs中添加了对于llm的初始设置。

### 2026/6/6 24:00
- 再次修改了llm.rs，现在的真实ai变得动态可配置了。
- 新增了config.rs文件，以支持运行时更新llm_api，显示llm配置信息。

### 2026/6/7 0:30
- 前端（index.html）新增 AI 周总结按钮和 AI 设置折叠面板，支持运行时配置 API Key/Base/Model。
- app.js 新增 loadConfig、handleWeeklySummary、handleSaveConfig、handleResetConfig 四个函数。
- styles.css 新增 .ai-weekly、.ai-settings、.btn-outline 等样式。
- handlers/ai.rs 修复 weekly_summary 中 state 被 spawn_blocking move 掉的 bug，提前 clone db/llm_advisor/ai_advisor。
- 新增 renderMarkdown() 函数，支持标题、加粗、斜体、代码块、列表、引用等 markdown 语法的前端渲染。
- AI 结果显示从 escHtml() 改为 renderMarkdown()，错误信息保留 escHtml 安全处理。
- styles.css 新增 .ai-result 内 markdown 元素（h1-h4/p/ul/ol/code/pre/blockquote/hr）的完整样式。
- ai/mock.rs 修复周总结序号全为 1 的问题，将每个任务的两行合并为一行，使有序列表连续。