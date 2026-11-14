import { goalProgress, metricValue, monthKey, smartTips, type Goal } from "./goals";
import type { Order } from "./types";

/** Month-to-date numbers for the popup, the badge and /api/summary. */
export function buildSummary(orders: Order[], goals: Goal[], now = new Date()) {
  const month = orders.filter((o) => monthKey(new Date(o.placedAt)) === monthKey(now));
  const progress = goals.map((g) => goalProgress(g, orders, now));
  return {
    month: monthKey(now),
    food: { spend: metricValue(month, { scope: "food", metric: "spend" }), orders: metricValue(month, { scope: "food", metric: "orders" }) },
    grocery: { spend: metricValue(month, { scope: "grocery", metric: "spend" }), orders: metricValue(month, { scope: "grocery", metric: "orders" }) },
    goals: progress.map((p) => ({ id: p.goal.id, label: p.goal.label, metric: p.goal.metric, value: p.value, limit: p.goal.limit, pct: p.pct, state: p.state })),
    over: progress.filter((p) => p.state === "over").length,
    warn: progress.filter((p) => p.state === "warn").length,
    tips: smartTips(orders, now).slice(0, 3).map((t) => t.text),
  };
}
