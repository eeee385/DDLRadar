use super::{AiAdvisor, AiError, AiTaskInfo};
// use super::now_string;
use crate::utils::{now_string,estimate_available_days};
use crate::models::{TaskType,Status,Priority,TaskWithRisk,Task};
pub struct MockAiAdvisor;

// 这是一个mock风格的模板化建议

fn generate_exam_advice(task_info: &AiTaskInfo, days: usize, priority_note: &str) -> String {
    let plan = match days {
        0..=1 => format!(
            "⚠️ 时间紧迫！仅剩 {} 天，建议：\n\
            📖 快速浏览核心考点和公式\n\
            📖 做几道重点题型熟悉思路\n\
            📖 保持冷静，调整心态\n\
            📖 确保休息充足，以最佳状态应考",
            days
        ),
        2..=3 => format!(
            "⏰ 时间较紧，剩余 {} 天，建议：\n\
            📖 第 1 天：梳理重点知识框架 + 做典型例题\n\
            📖 第 2 天：查漏补缺，模拟练习\n\
            📖 如有第 3 天：回顾错题，调整心态",
            days
        ),
        4..=7 => format!(
            "📚 剩余 {} 天，建议分阶段复习：\n\
            📖 第 1~2 天：梳理知识框架，整理重点\n\
            📖 第 3~4 天：做典型例题和往年试题\n\
            📖 第 5~6 天：模拟练习 + 查漏补缺\n\
            📖 第 7 天：最后浏览，调整心态",
            days
        ),
        _ => format!(
            "📚 时间充裕，剩余 {} 天，建议系统复习：\n\
            📖 前期：梳理知识框架，整理重点和公式\n\
            📖 中期：分模块做例题，攻克薄弱环节\n\
            📖 后期：模拟练习 + 限时训练\n\
            📖 考前 1~2 天：回顾错题，调整心态",
            days
        ),
    };
    format!(
        "📚 复习计划建议：「{}」\n\n{}\n\n{}\n\n💡 提示：距离考试约 {} 天，请根据自身情况灵活调整复习节奏。\n\n📅 考试时间：{}",
        task_info.title, priority_note, plan, days, task_info.deadline
    )
}

impl AiAdvisor for MockAiAdvisor {
    fn generate_advice(
        &self,
        _api_key: &str,
        _api_base: &str,
        _model: &str, 
        task_info: &AiTaskInfo
    ) -> Result<String, AiError> {
        let task_type=task_info.task_type.clone();
        let status=task_info.status.clone();
        let priority=task_info.priority.clone();
        
        let now_str = now_string();

        // 如果已完成
        if status == Status::Done  {
            return Ok(format!(
                "「{}」已完成！做得好！建议回顾一下学习笔记，巩固知识点。\n\n{}",
                task_info.title,
                now_str,
            ));
        }

        // 如果已逾期
        let tim=estimate_available_days(&task_info.deadline);
        if tim < 0 { 
            return Ok(format!(
                "「{}」已逾期。建议尽快与老师沟通，看是否可以补交。同时反思逾期原因，避免再次发生。\n\n{}",
                task_info.title,
                now_str,
            ));
        }


        // 根据任务类型生成建议
        let priority_note = match priority {
            Priority::High => "该任务优先级为「高」，建议立即开始处理。",
            Priority::Mid => "该任务优先级为「中」，建议合理安排时间。",
            _ => "该任务优先级较低，可在完成高优先级任务后再处理。",
        };

        match task_type {
            TaskType::Project => {
                Ok(format!(
                    "📋 任务拆解建议：「{}」\n\n{}\n\n建议拆分为以下步骤：\n\
                    1. 确定项目需求和范围\n\
                    2. 查阅相关资料和文献\n\
                    3. 设计项目方案和架构\n\
                    4. 逐步实现各模块功能\n\
                    5. 进行测试和调试\n\
                    6. 整理文档和报告\n\
                    7. 准备演示材料\n\n💡 提示：课程项目通常工作量较大，建议提前规划并定期检查进度。\n\n📅 截止时间：{}\n\n{}",
                    task_info.title, priority_note, task_info.deadline, now_str,
                ))
            }
            TaskType::Exam => {
                let days = estimate_available_days(&task_info.deadline);
                let days = days.max(1) as usize;
                Ok(format!("{}\n\n{}", generate_exam_advice(task_info, days, priority_note), now_str))
            }
            TaskType::Homework => {
                Ok(format!(
                    "✏️ 完成建议：「{}」\n\n{}\n\n建议完成步骤：\n\
                    1. 仔细阅读作业要求\n\
                    2. 回顾相关课程内容\n\
                    3. 独立完成作业题目\n\
                    4. 检查答案和格式\n\
                    5. 按时提交\n\n💡 提示：建议在截止时间前至少 1 天完成，留出检查时间。\n\n📅 截止时间：{}\n\n{}",
                    task_info.title, priority_note, task_info.deadline, now_str,
                ))
            }
            _ => {
                Ok(format!(
                    "📝 任务建议：「{}」\n\n{}\n\n建议行动：\n\
                    1. 明确任务具体要求\n\
                    2. 评估所需时间和资源\n\
                    3. 制定执行计划\n\
                    4. 分步骤完成\n\n💡 提示：合理规划时间，避免最后赶工。\n\n📅 截止时间：{}\n\n{}",
                    task_info.title, priority_note, task_info.deadline, now_str,
                ))
            }
        }
    }
    fn generate_weekly_summary(
        &self,
        _api_key: &str,
        _api_base: &str,
        _model: &str,
        tasks: &[crate::models::TaskWithRisk]
    ) -> Result<String, AiError> {
        let now_str=now_string();
        
        if tasks.is_empty(){
            return Ok(format!("🎉 未来 7 天内没有截止的任务，可以稍微放松一下！\n\n{}", now_str));
        }
        
        let mut summary=format!(
            "📊 本周 DDL 总结\n\n未来 7 天共有 {} 个任务需要关注：\n\n",
            tasks.len()
        );
        
        for (i,task) in tasks.iter().enumerate(){
            let risk_emoji=match task.risk_level.as_str() {
                "高风险" | "已逾期" => "🔴",
                "中风险" => "🟡",
                _ => "🟢",
            };
            let priority_note = match task.task.priority {
                Priority::High => "High",
                Priority::Mid => "Mid",
                _ => "Low",
            };
            let type_note=match task.task.task_type {
                TaskType::Project => "Project",
                TaskType::Exam => "Exam",
                TaskType::Homework => "Homework",
                _ => "Others",
                 
            };
            summary.push_str(&format!(
                "{}. {} {}「{}」- {}\n   截止：{} | 优先级：{}\n\n",
                i + 1,
                risk_emoji,
                type_note,
                task.task.title,
                task.task.course,
                task.task.deadline,
                priority_note,
            ));
        }
        let high_count=tasks.iter().filter(|t| t.risk_level == "高风险" || t.risk_level == "已逾期").count();
        if high_count > 0 {
            summary.push_str(&format!(
                "⚠️ 提示：本周有 {} 个高风险/逾期任务，建议优先处理！\n\n",
                high_count
            ));
        } else {
            summary.push_str("✅ 整体风险可控，按计划推进即可。\n\n");
        }

        summary.push_str(&now_str);
        Ok(summary)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_advice() {
        let mock=MockAiAdvisor{};
        let task_info = AiTaskInfo {
            title: "软件工程大作业".to_string(),
            course: "软件工程".to_string(),
            task_type: TaskType::Project,
            deadline: "2026-06-20 23:59".to_string(),
            priority: Priority::High,
            status: Status::Todo,
            description: "".to_string(),
        };
        let result = mock.generate_advice(" "," "," ",&task_info);
        match result {
            Ok(advice) => {
                println!("{}",advice);
                assert!(advice.contains("软件工程大作业"));
                assert!(advice.contains("任务拆解建议"));
                assert!(advice.contains("高"));
            }
            Err(error) => {
                eprintln!("获取建议失败：{:?}", error);
                std::process::exit(1);
            }
        }
    }

    #[test]
    fn test_exam_advice() {
        let mock=MockAiAdvisor{};
        let task_info = AiTaskInfo {
            title: "高等数学期末".to_string(),
            course: "高等数学".to_string(),
            task_type: TaskType::Exam,
            deadline: "2026-06-25 09:00".to_string(),
            priority: Priority::High,
            status: Status::Todo,
            description: "".to_string(),
        };
        let result = mock.generate_advice(" "," "," ",&task_info);
        match result {
            Ok(advice) => {
                println!("{}",advice);
                assert!(advice.contains("高等数学期末"));
                assert!(advice.contains("复习计划"));
            }
            Err(error) => {
                eprintln!("获取建议失败：{:?}", error);
                std::process::exit(1);
            }
        }
    }

    #[test]
    fn test_done_advice() {
        let mock=MockAiAdvisor{};
        let task_info = AiTaskInfo {
            title: "已完成作业".to_string(),
            course: "测试课程".to_string(),
            task_type: TaskType::Homework,
            deadline: "2026-01-01 00:00".to_string(),
            priority: Priority::Low,
            status: Status::Todo,
            description: "".to_string(),
        };
        let result = mock.generate_advice(" "," "," ",&task_info);
        match result {
            Ok(advice) => {
                println!("{}",advice);
                assert!(advice.contains("已完成"));
            }
            Err(error) => {
                eprintln!("获取建议失败：{:?}", error);
                std::process::exit(1);
            }
        }
    }

    #[test]
    fn test_estimate_available_days() {
        use chrono::Local;
        let future = Local::now().naive_local() + chrono::Duration::days(5);
        let deadline = future.format("%Y-%m-%d %H:%M").to_string();
        let days = estimate_available_days(&deadline);
        assert!(days >= 4 && days <= 6);
    }
    #[test]
    fn test_generate_weekly_summary(){
        let mock=MockAiAdvisor{};
        let tasks = vec![
            crate::models::TaskWithRisk {
                task: 
                Task {
                    id: 0,
                    title: "高风险任务".to_string(),
                    course: "课程A".to_string(),
                    task_type: TaskType::Homework,
                    deadline: "2026-06-20 23:59".to_string(),
                    priority: Priority::High,
                    status: Status::Todo,
                    description: "".to_string(),
                    created_at: "".to_string(),
                    updated_at: "".to_string(),
                },
                risk_level: "高风险".to_string(),
                is_overdue: false,
            },
            crate::models::TaskWithRisk {
                task: Task {
                    id: 1,
                    title: "中风险任务".to_string(),
                    course: "课程B".to_string(),
                    task_type: TaskType::Exam,
                    deadline: "2026-06-22 09:00".to_string(),
                    priority: Priority::Mid,
                    status: Status::Todo,
                    description: "".to_string(),
                    created_at: "".to_string(),
                    updated_at: "".to_string(),
                },
                risk_level: "中风险".to_string(),
                is_overdue: false,
            },
        ];
        let result = mock.generate_weekly_summary(" "," "," ",&tasks);
        match result {
            Ok(summary) => {
                println!("{}",summary);
                assert!(summary.contains("本周 DDL 总结"));
                assert!(summary.contains("高风险任务"));
                assert!(summary.contains("中风险任务"));
            }
            Err(error) => {
                eprintln!("获取总结失败：{:?}", error);
                std::process::exit(1);
            }
        }
    }
}
