pub fn now_string() -> String {
    let now = chrono::Local::now();
    format!("🕐 生成时间：{}", now.format("%Y-%m-%d %H:%M:%S"))
}

/// 估算可用天数
pub fn estimate_available_days(deadline: &str) -> i64 {
    estimate_available_days_at(deadline, chrono::Local::now().naive_local())
}

/// 使用指定的当前时间估算可用天数，便于稳定测试时间边界。
pub(crate) fn estimate_available_days_at(deadline: &str, now: chrono::NaiveDateTime) -> i64 {
    use chrono::NaiveDateTime;

    let dl = NaiveDateTime::parse_from_str(deadline, "%Y-%m-%d %H:%M")
        .or_else(|_| {
            NaiveDateTime::parse_from_str(&format!("{} 23:59", deadline), "%Y-%m-%d %H:%M")
        })
        .unwrap_or(now);
    let duration = dl.signed_duration_since(now);
    if duration.num_minutes() < 0 {
        -1
    } else {
        duration.num_hours() / 24
    }
}

#[cfg(test)]
mod tests {
    use super::estimate_available_days_at;
    use chrono::NaiveDateTime;

    fn dt(value: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M").unwrap()
    }

    #[test]
    fn estimates_days_from_an_explicit_clock() {
        assert_eq!(
            estimate_available_days_at("2030-01-06 12:00", dt("2030-01-01 12:00")),
            5
        );
    }

    #[test]
    fn reports_past_deadline_as_overdue() {
        assert_eq!(
            estimate_available_days_at("2030-01-01 11:59", dt("2030-01-01 12:00")),
            -1
        );
    }
}
