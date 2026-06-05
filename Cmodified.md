# role C 新增项：
### 2026/6/4 23:36
- src/models.rs 新增枚举类型 RiskLevel，便于表达风险等级
- src/ai/mod.rs 新增周总结方法
- src/models.rs Status枚举类型新增项Overdue，表示逾期状态

### 2026/6/5 9:32
- utils.rs 新增工具包文件
- main.rs 新增声明 mod utils
- ai/mock.rs 新增单元测试
- ai/mod.rs 新增考试建议方法generate_exam_advice，以求更加合理的建议
- db.rs status_str方法中新增对于Overdue的处理
- llm.rs 暂未实现