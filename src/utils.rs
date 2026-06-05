pub fn now_string() -> String {
    let now = chrono::Local::now();
    format!("🕐 生成时间：{}", now.format("%Y-%m-%d %H:%M:%S"))
}

/// 估算可用天数
pub fn estimate_available_days(deadline: &str) -> i64 {
    use chrono::{Local, NaiveDateTime};
    let dl = NaiveDateTime::parse_from_str(deadline, "%Y-%m-%d %H:%M")
        .or_else(|_| NaiveDateTime::parse_from_str(&format!("{} 23:59", deadline), "%Y-%m-%d %H:%M"))
        .unwrap_or_else(|_| Local::now().naive_local());
    let now = Local::now().naive_local();
    let duration = dl.signed_duration_since(now);
    duration.num_hours().max(1) / 24
}

