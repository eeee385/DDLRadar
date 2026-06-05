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