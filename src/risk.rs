use chrono::NaiveDateTime;
use crate::models::{Priority, Status};

#[derive(Debug, Clone)]
pub struct RiskInfo {
    pub risk_level: String,
    pub is_overdue: bool,
}

/// Stub implementation — Role C replaces this with real risk calculation logic.
pub fn calculate_risk(
    _deadline: &str,
    _priority: &Priority,
    status: &Status,
    _now: NaiveDateTime,
) -> RiskInfo {
    if *status == Status::Done {
        RiskInfo {
            risk_level: "已完成".to_string(),
            is_overdue: false,
        }
    } else {
        RiskInfo {
            risk_level: "低风险".to_string(),
            is_overdue: false,
        }
    }
}
