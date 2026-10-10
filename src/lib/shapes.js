// Presentation shapes for the copy API rows. The API returns full DB rows
// (copy_subscriptions / copy_executions joined with the leader's identity); these
// helpers project them into clean, documented, agent-facing objects so a tool's
// output is self-describing — leader info grouped, guard rules grouped, numbers
// coerced from Postgres numeric strings into real numbers.

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Group the leader-identity columns the API joins onto every row. */
function leaderOf(row) {
	return {
		agent_id: row.leader_agent_id ?? null,
		name: row.leader_name ?? null,
		image: row.leader_image ?? row.leader_avatar ?? null,
		wallet: row.leader_wallet ?? null,
	};
}

/**
 * Shape a copy_subscriptions row (+ joined leader + counts) into a documented
 * subscription object: identity, status, sizing rule, guard rules, and the
 * pending/acted execution counts the list endpoint computes.
 */
export function shapeSubscription(row) {
	if (!row || typeof row !== 'object') return row;
	return {
		id: row.id,
		status: row.status, // 'active' | 'paused' | 'stopped'
		network: row.network,
		leader: leaderOf(row),
		copier_wallet: row.copier_wallet,
		sizing: {
			rule: row.sizing_rule, // 'fixed' | 'multiplier' | 'pct_balance'
			fixed_sol: num(row.fixed_sol),
			multiplier: num(row.multiplier),
			pct_balance: num(row.pct_balance),
		},
		guards: {
			per_trade_cap_sol: num(row.per_trade_cap_sol),
			min_order_sol: num(row.min_order_sol),
			daily_budget_sol: num(row.daily_budget_sol),
			max_open_copies: num(row.max_open_copies),
			mcap_floor_usd: num(row.mcap_floor_usd),
			mcap_ceiling_usd: num(row.mcap_ceiling_usd),
			copy_sells: row.copy_sells,
			require_safety_pass: row.require_safety_pass,
			min_oracle_score: num(row.min_oracle_score),
		},
		perf_fee_bps: num(row.perf_fee_bps),
		high_water_mark_sol: num(row.high_water_mark_sol),
		telegram_chat_id: row.telegram_chat_id ?? null,
		pending_count: row.pending_count === undefined ? undefined : Number(row.pending_count),
		acted_count: row.acted_count === undefined ? undefined : Number(row.acted_count),
		created_at: row.created_at ?? null,
		updated_at: row.updated_at ?? null,
	};
}

/**
 * Shape a copy_executions row (+ joined leader) into a documented copy-intent
 * object: the coin, the mirrored direction, the sized order, why it was skipped
 * (if it was), its lifecycle status, and the copier's recorded fill signature.
 */
export function shapeExecution(row) {
	if (!row || typeof row !== 'object') return row;
	return {
		id: row.id,
		subscription_id: row.subscription_id,
		status: row.status, // 'pending' | 'acted' | 'dismissed' | 'skipped' | 'expired'
		network: row.network,
		leader: leaderOf(row),
		coin: { mint: row.mint, symbol: row.symbol ?? null, name: row.name ?? null },
		direction: row.direction, // 'buy' | 'sell'
		planned_sol: num(row.planned_sol),
		leader_entry_sol: num(row.leader_entry_sol),
		skip_reason: row.skip_reason ?? null,
		safety: row.safety ?? null,
		quote: row.quote ?? null,
		tx_signature: row.tx_signature ?? null,
		created_at: row.created_at ?? null,
		updated_at: row.updated_at ?? null,
		expires_at: row.expires_at ?? null,
	};
}
