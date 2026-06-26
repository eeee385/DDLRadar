use crate::models::{Priority, Status};
use chrono::NaiveDateTime;

// 风险计算结果结构体
// risk_level 用于前端展示和 Dashboard 统计
// is_overdue 用于判断是否已逾期
#[derive(Debug, Clone)]
pub struct RiskInfo {
    pub risk_level: String,
    pub is_overdue: bool,
}

/// 计算任务风险等级
/// 返回英文代码以便前后端统一处理：
///   "completed" - 已完成
///   "overdue"   - 已逾期
///   "high"      - 高风险
///   "mid"       - 中风险
///   "low"       - 低风险
pub fn calculate_risk(
    _deadline: &str,
    _priority: &Priority,
    status: &Status,
    _now: NaiveDateTime,
) -> RiskInfo {
    if *status == Status::Done {
        return RiskInfo {
            risk_level: "completed".to_string(),
            is_overdue: false,
        };
    }

    // deadline 格式异常时，为避免接口崩溃，返回默认低风险
    let deadline_time = match NaiveDateTime::parse_from_str(_deadline, "%Y-%m-%d %H:%M") {
        Ok(t) => t,
        Err(_) => {
            return RiskInfo {
                risk_level: "low".to_string(),
                is_overdue: false,
            };
        }
    };

    let remaining = deadline_time - _now;

    if remaining.num_seconds() < 0 {
        return RiskInfo {
            risk_level: "overdue".to_string(),
            is_overdue: true,
        };
    }

    let hours = remaining.num_hours();

    // 如果任务还有24小时到期，一律归为高风险
    let risk_level = if hours <= 24 {
        "high"
    } else if hours <= 72 {
        // 如果任务还有72小时到期，那么高优先级的任务归为高风险，其他归为中风险
        match _priority {
            Priority::High => "high",
            _ => "mid",
        }
    } else if hours <= 168 {
        // 逻辑同上
        match _priority {
            Priority::High => "mid",
            _ => "low",
        }
    } else {
        "low"
    };

    RiskInfo {
        risk_level: risk_level.to_string(),
        is_overdue: false,
    }
}

// 测试用例
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDateTime;

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()
    }

    #[test]
    fn done_task_is_completed() {
        let result = calculate_risk(
            "2026-06-20 23:59",
            &Priority::High,
            &Status::Done,
            dt("2026-06-19 23:59"),
        );

        assert_eq!(result.risk_level, "completed");
        assert!(!result.is_overdue);
    }

    #[test]
    fn overdue_task_is_overdue() {
        let result = calculate_risk(
            "2026-06-20 23:59",
            &Priority::High,
            &Status::Todo,
            dt("2026-06-21 00:00"),
        );

        assert_eq!(result.risk_level, "overdue");
        assert!(result.is_overdue);
    }

    #[test]
    fn high_priority_within_one_day_is_high_risk() {
        let result = calculate_risk(
            "2026-06-20 23:59",
            &Priority::High,
            &Status::Todo,
            dt("2026-06-20 10:00"),
        );

        assert_eq!(result.risk_level, "high");
        assert!(!result.is_overdue);
    }

    #[test]
    fn low_priority_far_deadline_is_low_risk() {
        let result = calculate_risk(
            "2026-06-30 23:59",
            &Priority::Low,
            &Status::Todo,
            dt("2026-06-20 10:00"),
        );

        assert_eq!(result.risk_level, "low");
        assert!(!result.is_overdue);
    }
}