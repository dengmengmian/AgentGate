//! Daily spend hard gate: after today's cost exceeds a threshold, new requests
//! may be blocked or forced onto cheapest routing. Streams already in flight
//! are never mid-cut (only checked at request entry).

use crate::errors::{codes, AppError};
use crate::models::gateway::GatewaySettings;
use crate::storage::db::DbPool;

/// Strategy string values stored in gateway_settings.cost_budget_strategy.
pub const STRATEGY_NOTIFY_ONLY: &str = "notify_only";
pub const STRATEGY_BLOCK: &str = "block";
pub const STRATEGY_FORCE_CHEAPEST: &str = "force_cheapest";

#[derive(Debug, Clone, PartialEq)]
pub enum BudgetDecision {
    /// Under threshold or gate off — proceed normally.
    Allow,
    /// Over threshold: reject new requests with a structured error.
    Block { today_cost: f64, threshold: f64 },
    /// Over threshold: continue but force cheapest candidate ordering.
    ForceCheapest { today_cost: f64, threshold: f64 },
}

/// Pure policy: no I/O. Unit-tested without HTTP.
///
/// - disabled / missing / non-positive threshold → Allow
/// - under threshold → Allow
/// - over + notify_only → Allow (alert path is separate)
/// - over + block → Block
/// - over + force_cheapest → ForceCheapest
pub fn evaluate(
    enabled: bool,
    threshold: Option<f64>,
    strategy: &str,
    today_cost: f64,
) -> BudgetDecision {
    if !enabled {
        return BudgetDecision::Allow;
    }
    let Some(threshold) = threshold.filter(|t| t.is_finite() && *t > 0.0) else {
        return BudgetDecision::Allow;
    };
    if today_cost <= threshold {
        return BudgetDecision::Allow;
    }
    match strategy {
        STRATEGY_BLOCK => BudgetDecision::Block {
            today_cost,
            threshold,
        },
        STRATEGY_FORCE_CHEAPEST => BudgetDecision::ForceCheapest {
            today_cost,
            threshold,
        },
        _ => BudgetDecision::Allow,
    }
}

/// Read settings + today's cost from DB and evaluate. Call at request entry only.
pub fn evaluate_from_db(db: &DbPool) -> Result<BudgetDecision, AppError> {
    let conn = db.get().map_err(|_| AppError::internal("DB lock failed"))?;
    let settings = crate::storage::gateway_settings::get(&conn)?;
    let today_cost = crate::storage::request_logs::get_stats(&conn)?.today_cost;
    Ok(evaluate(
        settings.cost_budget_enabled,
        settings.cost_budget_threshold,
        &settings.cost_budget_strategy,
        today_cost,
    ))
}

/// Convert Block into a gateway AppError with actionable message.
pub fn block_error(today_cost: f64, threshold: f64) -> AppError {
    AppError::new(
        codes::DAILY_BUDGET_EXCEEDED,
        format!(
            "Daily spend ${today_cost:.4} exceeds budget threshold ${threshold:.4}. New requests are blocked."
        ),
    )
    .with_suggestion(
        "Raise the daily budget in Settings, switch strategy to force_cheapest, or wait until tomorrow.",
    )
}

/// Convenience: if decision is Block, return Err; if ForceCheapest return Ok(true);
/// Allow → Ok(false).
pub fn check_new_request(db: &DbPool) -> Result<bool, AppError> {
    match evaluate_from_db(db)? {
        BudgetDecision::Allow => Ok(false),
        BudgetDecision::ForceCheapest { .. } => Ok(true),
        BudgetDecision::Block {
            today_cost,
            threshold,
        } => Err(block_error(today_cost, threshold)),
    }
}

/// When force_cheapest is active, re-order selection candidates by unit price
/// and point `provider`/`model` at the cheapest non-cooldown candidate.
pub fn apply_force_cheapest(
    db: &DbPool,
    selection: &mut crate::gateway::provider_selector::ProviderSelection,
) -> Result<(), AppError> {
    if selection.candidates.is_empty() {
        return Ok(());
    }
    let conn = db.get().map_err(|_| AppError::internal("DB lock failed"))?;
    crate::gateway::provider_selector::force_cheapest_order(&conn, &mut selection.candidates);
    // Prefer first non-cooldown after sort; fall back to first.
    let pick = selection
        .candidates
        .iter()
        .find(|c| !c.in_cooldown)
        .or_else(|| selection.candidates.first())
        .cloned();
    if let Some(c) = pick {
        if let Ok(p) = crate::storage::providers::get_by_id(&conn, &c.provider_id) {
            selection.provider = p;
            selection.model = c.model.clone();
            selection.reason = format!(
                "{}; daily budget force_cheapest → {}",
                selection.reason, c.provider_name
            );
            // Ensure failover can still walk the reordered list.
            if selection.mode == "manual" {
                selection.mode = "failover".to_string();
            }
        }
    }
    Ok(())
}

/// Normalize strategy string for storage.
pub fn normalize_strategy(s: &str) -> String {
    match s {
        STRATEGY_BLOCK | STRATEGY_FORCE_CHEAPEST | STRATEGY_NOTIFY_ONLY => s.to_string(),
        _ => STRATEGY_NOTIFY_ONLY.to_string(),
    }
}

/// Defaults used when columns are missing in partial structs (tests).
pub fn strategy_from_settings(settings: &GatewaySettings) -> &str {
    settings.cost_budget_strategy.as_str()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabled_always_allows() {
        assert_eq!(
            evaluate(false, Some(1.0), STRATEGY_BLOCK, 99.0),
            BudgetDecision::Allow
        );
    }

    #[test]
    fn under_threshold_allows() {
        assert_eq!(
            evaluate(true, Some(10.0), STRATEGY_BLOCK, 9.99),
            BudgetDecision::Allow
        );
    }

    #[test]
    fn over_block() {
        assert_eq!(
            evaluate(true, Some(5.0), STRATEGY_BLOCK, 5.01),
            BudgetDecision::Block {
                today_cost: 5.01,
                threshold: 5.0,
            }
        );
    }

    #[test]
    fn over_force_cheapest() {
        assert_eq!(
            evaluate(true, Some(1.0), STRATEGY_FORCE_CHEAPEST, 2.0),
            BudgetDecision::ForceCheapest {
                today_cost: 2.0,
                threshold: 1.0,
            }
        );
    }

    #[test]
    fn over_notify_only_allows() {
        assert_eq!(
            evaluate(true, Some(1.0), STRATEGY_NOTIFY_ONLY, 9.0),
            BudgetDecision::Allow
        );
    }

    #[test]
    fn zero_or_missing_threshold_allows() {
        assert_eq!(
            evaluate(true, None, STRATEGY_BLOCK, 100.0),
            BudgetDecision::Allow
        );
        assert_eq!(
            evaluate(true, Some(0.0), STRATEGY_BLOCK, 100.0),
            BudgetDecision::Allow
        );
        assert_eq!(
            evaluate(true, Some(-1.0), STRATEGY_BLOCK, 100.0),
            BudgetDecision::Allow
        );
    }

    #[test]
    fn block_error_mentions_costs() {
        let e = block_error(12.3456, 10.0);
        assert_eq!(e.code, codes::DAILY_BUDGET_EXCEEDED);
        assert!(e.message.contains("12.3456"));
        assert!(e.message.contains("10.0000"));
    }

    #[test]
    fn normalize_strategy_defaults_unknown() {
        assert_eq!(normalize_strategy("block"), STRATEGY_BLOCK);
        assert_eq!(normalize_strategy("nope"), STRATEGY_NOTIFY_ONLY);
    }
}
