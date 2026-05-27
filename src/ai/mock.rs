use super::{AiAdvisor, AiError, AiTaskInfo};
use crate::models::TaskType;

pub struct MockAiAdvisor;

impl AiAdvisor for MockAiAdvisor {
    fn generate_advice(&self, task_info: &AiTaskInfo) -> Result<String, AiError> {
        let advice = match task_info.task_type {
            TaskType::Project => format!(
                "针对「{}」课程项目，建议按以下步骤推进：\n1. 需求分析与方案设计\n2. 数据库/接口设计\n3. 核心功能实现\n4. 测试与文档整理\n5. 答辩准备",
                task_info.title
            ),
            TaskType::Exam => format!(
                "针对「{}」考试，建议制定复习计划：\n1. 梳理知识框架\n2. 重点章节复习\n3. 历年真题练习\n4. 错题整理回顾\n5. 考前冲刺",
                task_info.title
            ),
            TaskType::Homework => format!(
                "针对「{}」作业，建议：\n1. 回顾课堂内容\n2. 独立完成基础部分\n3. 检查格式与完整性\n4. 按截止时间提交",
                task_info.title
            ),
            TaskType::Other => format!(
                "针对「{}」，建议合理安排时间，确保在截止日期前完成。",
                task_info.title
            ),
        };
        Ok(advice)
    }
}
