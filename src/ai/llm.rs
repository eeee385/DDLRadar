use super::{AiAdvisor, AiError, AiTaskInfo};
// use super::now_string;
use crate::utils::{now_string,estimate_available_days};
use crate::models::{TaskType,Status,Priority,TaskWithRisk,Task};
pub struct LLMAiAdvisor;
use serde_json::json;

// 这是一个mock风格的模板化建议
fn build_llm_prompt(task_info: &AiTaskInfo) -> String {
    let type_label = match task_info.task_type {
        TaskType::Homework => "作业",
        TaskType::Exam => "考试",
        TaskType::Project => "项目",
        _ => "任务",
    };

    let priority_label = match task_info.priority {
        Priority::High => "高",
        Priority::Mid => "中",
        _ => "低",
    };

    let status_label = match task_info.status {
        Status::Todo => "待办",
        Status::Doing => "进行中",
        Status::Done => "已完成",
        _ => "不明",
    };

    let now_str = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let remaining_days = estimate_available_days(&task_info.deadline).max(0);

    format!(
        "你是一个帮助学生管理学习任务的智能助手。请根据以下任务信息，给出具体、实用、可操作的建议。\n\
         请严格基于当前时间和截止时间的关系来规划建议，确保建议在时间上是合理的。\n\
         用中文回答,控制在300字以内。\n\n\
         📅 当前时间：{}\n\
         任务标题：{}\n\
         课程：{}\n\
         任务类型：{}\n\
         截止时间：{}\n\
         剩余天数：{} 天\n\
         优先级：{}\n\
         当前状态：{}\n\
         任务描述：{}\n\n\
         请给出你的建议：",
        now_str,
        task_info.title,
        task_info.course,
        type_label,
        task_info.deadline,
        remaining_days,
        priority_label,
        status_label,
        if task_info.description.is_empty() { "无" } else { &task_info.description },
    )
}



impl AiAdvisor for LLMAiAdvisor {
    fn generate_advice(
        &self,
        _api_key: &str,
        _api_base: &str,
        _model: &str,
        task_info: &AiTaskInfo,
    ) -> Result<String, AiError> {
        let prompt = build_llm_prompt(task_info);
        
        let url = format!("{}/chat/completions", _api_base.trim_end_matches('/'));

        let body = json!({
            "model": _model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个帮助学生管理学习任务的智能助手。你必须严格根据当前时间和截止时间的关系来给出建议。如果只剩1天，给出紧急应对方案而非多天计划。用中文回答，控制在300字以内。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.5,
            "max_tokens": 600
        });

        let response = ureq::post(&url)
            .set("Authorization", &format!("Bearer {}", _api_key))
            .set("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(30))
            .send_string(&body.to_string())
            .map_err(|e| AiError(format!("请求失败: {}", e)))?;

        let resp_body = response
            .into_string()
            .map_err(|e| AiError(format!("读取响应失败: {}", e)))?;

        let json_resp: serde_json::Value = serde_json::from_str(&resp_body)
            .map_err(|e| AiError(format!("解析 JSON 失败: {}", e)))?;

        let content = json_resp["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("（未能获取到有效回复）")
            .to_string();

        Ok(content)
    }
    fn generate_weekly_summary(
        &self,
        _api_key: &str,
        _api_base: &str,
        _model: &str,
        tasks: &[crate::models::TaskWithRisk],
    ) -> Result<String, AiError> {
        if tasks.is_empty() {
            return Ok("🎉 未来 7 天内没有截止的任务，可以稍微放松一下！".to_string());
        }
        // 构建任务列表文本
        let mut task_list = String::new();
        for (i, task) in tasks.iter().enumerate() {
            let type_label = match task.task.task_type {
                TaskType::Homework => "作业",
                TaskType::Exam => "考试",
                TaskType::Project => "项目",
                _ => "任务",
            };
            let priority_label = match task.task.priority {
                Priority::High => "高",
                Priority::Mid => "中",
                _ => "低",
            };
            let status_label = match task.task.status {
                Status::Todo => "待办",
                Status::Doing => "进行中",
                Status::Done => "已完成",
                _ => "unknown",
            };
            let risk_label = task.risk_level.as_str() ;

            task_list.push_str(&format!(
                "{}. 「{}」({}) - 课程：{} | 截止：{} | 优先级：{} | 状态：{} | 风险：{}\n",
                i + 1, task.task.title, type_label, task.task.course, task.task.deadline, priority_label, status_label, risk_label
            ));
        }

        let now_str = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let prompt = format!(
            "你是一个帮助学生管理学习任务的智能助手。以下是学生未来7天内的任务列表，请分析并给出一个本周总结建议。\n\
            请严格基于当前时间来判断哪些任务紧迫、哪些已逾期，给出准确的时间规划建议。\n\
            包括：整体评估、需要优先关注的任务、时间安排建议、风险提示等。用中文回答，控制在400字以内。\n\n\
            📅 当前时间：{}\n\
            任务列表：\n{}\n\n\
            请给出你的本周总结建议：",
            now_str,
            task_list
        );

        let url = format!("{}/chat/completions", _api_base.trim_end_matches('/'));

        let body = json!({
            "model": _model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个帮助学生管理学习任务的智能助手。你必须严格根据当前时间来判断各任务的紧迫程度，给出准确的周总结建议。用中文回答，控制在400字以内。"
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.5,
            "max_tokens": 800
        });

        let response = ureq::post(&url)
            .set("Authorization", &format!("Bearer {}", _api_key))
            .set("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(30))
            .send_string(&body.to_string())
            .map_err(|e| AiError(format!("请求失败: {}", e)))?;

        let resp_body = response
            .into_string()
            .map_err(|e| AiError(format!("读取响应失败: {}", e)))?;

        let json_resp: serde_json::Value = serde_json::from_str(&resp_body)
            .map_err(|e| AiError(format!("解析 JSON 失败: {}", e)))?;

        let content = json_resp["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("（未能获取到有效回复）")
            .to_string();

        Ok(content)
    }
}


#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn build_llm_prompt_includes_key_task_fields() {
        let task_info = AiTaskInfo {
            title: "高数作业一".to_string(),
            course: "高等数学".to_string(),
            task_type: TaskType::Homework,
            deadline: "2026-01-01 23:59:59".to_string(),
            priority: Priority::High,
            status: Status::Doing,
            description: "完成前两章习题".to_string(),
        };

        let prompt = build_llm_prompt(&task_info);
        println!("{}",prompt);
        assert!(prompt.contains("高数作业一"));
        assert!(prompt.contains("高等数学"));
        assert!(prompt.contains("作业"));
        assert!(prompt.contains("高"));
        assert!(prompt.contains("进行中"));
        assert!(prompt.contains("完成前两章习题"));
    }

    #[test]
    fn generate_weekly_summary_returns_empty_message_for_no_tasks() {
        let advisor = LLMAiAdvisor;

        let result = advisor.generate_weekly_summary("", "", "", &[]);
        assert!(result.is_ok());
        match result {
            Ok(advice) => {
                println!("{}",advice);
                assert_eq!(advice, "🎉 未来 7 天内没有截止的任务，可以稍微放松一下！");
            }
            Err(error) => {
                eprintln!("获取建议失败：{:?}", error);
                std::process::exit(1);
            }
        }
    }

    // #[test]
    // fn test_generate_advice_with_real_llm() {
    //     let api_key = "114514".to_string();
    //     let api_base = "https://api.deepseek.com".to_string();
    //     let model = "deepseek-v4-flash".to_string();

    //     let task_info = AiTaskInfo {
    //         title: "数据库课程设计".to_string(),
    //         course: "数据库原理".to_string(),
    //         task_type: TaskType::Project,
    //         deadline: "2026-06-10 23:59:59".to_string(),
    //         priority: Priority::High,
    //         status: Status::Doing,
    //         description: "设计一个学生选课系统的ER图和数据库表结构".to_string(),
    //     };

    //     let advisor = LLMAiAdvisor;
    //     let result = advisor.generate_advice(&api_key, &api_base, &model, &task_info);

    //     match result {
    //         Ok(advice) => {
    //             println!("=== generate_advice 返回结果 ===");
    //             println!("{}", advice);
    //             assert!(!advice.is_empty(), "建议内容不应为空");
    //         }
    //         Err(e) => {
    //             panic!("generate_advice 调用失败: {:?}", e);
    //         }
    //     }
    // }

    // #[test]
    // fn test_generate_weekly_summary_with_real_llm() {
    //     let api_key = "114514".to_string();
    //     let api_base = "https://api.deepseek.com".to_string();
    //     let model = "deepseek-v4-flash".to_string();

    //     let tasks = vec![
    //         TaskWithRisk {
    //             task: Task {
    //                 id: 1,
    //                 title: "高数作业".to_string(),
    //                 course: "高等数学".to_string(),
    //                 task_type: TaskType::Homework,
    //                 deadline: "2026-06-07 23:59:59".to_string(),
    //                 priority: Priority::High,
    //                 status: Status::Todo,
    //                 description: "第三章课后习题".to_string(),
    //                 created_at: "2026-06-01".to_string(),
    //                 updated_at: "2026-06-01".to_string(),
    //             },
    //             risk_level: "高".to_string(),
    //             is_overdue: false,
    //         },
    //         TaskWithRisk {
    //             task: Task {
    //                 id: 2,
    //                 title: "软件工程报告".to_string(),
    //                 course: "软件工程".to_string(),
    //                 task_type: TaskType::Project,
    //                 deadline: "2026-06-09 23:59:59".to_string(),
    //                 priority: Priority::Mid,
    //                 status: Status::Doing,
    //                 description: "撰写需求分析文档".to_string(),
    //                 created_at: "2026-06-02".to_string(),
    //                 updated_at: "2026-06-03".to_string(),
    //             },
    //             risk_level: "中".to_string(),
    //             is_overdue: false,
    //         },
    //     ];

    //     let advisor = LLMAiAdvisor;
    //     let result = advisor.generate_weekly_summary(&api_key, &api_base, &model, &tasks);

    //     match result {
    //         Ok(summary) => {
    //             println!("=== generate_weekly_summary 返回结果 ===");
    //             println!("{}", summary);
    //             assert!(!summary.is_empty(), "周总结内容不应为空");
    //         }
    //         Err(e) => {
    //             panic!("generate_weekly_summary 调用失败: {:?}", e);
    //         }
    //     }
    // }

}