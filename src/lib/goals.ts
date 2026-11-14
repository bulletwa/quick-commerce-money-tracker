import type { Order } from "./types";

export type Scope = "food" | "grocery" | "all";
export type Metric = "spend" | "orders" | "small_orders" | "late_night" | "tobacco_orders";

/** A monthly limit. Lower is always better: spend a budget, count an order cap. */
export interface Goal {
  id: string;
  label: string;
  scope: Scope;
  metric: Metric;
  limit: number; // INR for "spend", otherwise number of orders per month
  threshold?: number; // INR, only for "small_orders" (orders below this total)
}

export const SCOPES: Scope[] = ["food", "grocery", "all"];
export const METRICS: Metric[] = ["spend", "orders", "small_orders", "late_night", "tobacco_orders"];
export const METRIC_LABEL: Record<Metric, string> = {
  spend: "Spend (₹)", orders: "Orders", small_orders: "Small orders", late_night: "Late-night orders (10pm–4am)", tobacco_orders: "Orders with tobacco",
};

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

function inScope(o: Order, s: Scope) { return s === "all" || o.type === s; }

/** The number a goal tracks, for the given orders (already limited to one month by the caller). */
export function metricValue(orders: Order[], g: Pick<Goal, "scope" | "metric" | "threshold">): number {
  let v = 0;
  for (const o of orders) {
    if (!inScope(o, g.scope)) continue;
    const h = new Date(o.placedAt).getHours();
    if (g.metric === "spend") v += o.total;
    else if (g.metric === "orders") v += 1;
    else if (g.metric === "small_orders") v += o.total < (g.threshold ?? 200) ? 1 : 0;
    else if (g.metric === "late_night") v += h >= 22 || h < 4 ? 1 : 0;
    else if (g.metric === "tobacco_orders") v += o.items.some((i) => i.category === "Tobacco") ? 1 : 0;
  }
  return v;
}

/** Orders bucketed by local calendar month. */
export function byMonth(orders: Order[]): Map<string, Order[]> {
  const m = new Map<string, Order[]>();
  for (const o of orders) {
    const k = monthKey(new Date(o.placedAt));
    (m.get(k) ?? m.set(k, []).get(k)!).push(o);
  }
  return m;
}

export interface MonthPoint { month: string; value: number; met: boolean }
export interface Progress {
  goal: Goal;
  value: number; // this month so far
  pct: number; // value / limit
  state: "ok" | "warn" | "over";
  projected: number; // month-end pace
  baseline: number; // average of the previous up-to-12 full months
  vsBaselinePct: number | null; // projected vs baseline, negative = improving
  history: MonthPoint[]; // last 6 full months, oldest first
  streak: number; // consecutive full months at or under the limit, ending last month
  remaining: number; // limit - value (can be negative)
}

export function goalProgress(g: Goal, orders: Order[], now = new Date()): Progress {
  const months = byMonth(orders);
  const cur = monthKey(now);
  const value = metricValue(months.get(cur) ?? [], g);
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = Math.max(1, now.getDate()) / dim;
  const projected = value / elapsed;

  // Baseline: previous full months (up to 12), but never before the user's first order.
  const first = orders.reduce((m, o) => Math.min(m, new Date(o.placedAt).getTime()), Infinity);
  const firstMonth = isFinite(first) ? monthKey(new Date(first)) : cur;
  const past: MonthPoint[] = [];
  for (let n = 12; n >= 1; n--) {
    const k = monthKey(addMonths(now, -n));
    if (k < firstMonth) continue;
    const v = metricValue(months.get(k) ?? [], g);
    past.push({ month: k, value: v, met: v <= g.limit });
  }
  const baseline = past.length ? past.reduce((s, p) => s + p.value, 0) / past.length : 0;
  let streak = 0;
  for (let i = past.length - 1; i >= 0 && past[i].met; i--) streak++;

  const pct = g.limit > 0 ? value / g.limit : value > 0 ? 2 : 0; // a limit of 0 is exceeded by any order
  return {
    goal: g, value, pct, state: pct > 1 ? "over" : pct >= 0.8 ? "warn" : "ok", projected, baseline,
    vsBaselinePct: baseline > 0 ? ((projected - baseline) / baseline) * 100 : null,
    history: past.slice(-6), streak, remaining: g.limit - value,
  };
}

export function describeGoal(g: Goal) {
  const where = g.scope === "all" ? "food + grocery" : g.scope;
  const n = g.limit.toLocaleString("en-IN");
  if (g.metric === "spend") return `Spend on ${where}: at most ₹${n} a month`;
  if (g.metric === "orders") return `Number of ${where} orders: at most ${n} a month`;
  if (g.metric === "small_orders") return `${where[0].toUpperCase() + where.slice(1)} orders under ₹${g.threshold ?? 200}: at most ${n} a month`;
  if (g.metric === "late_night") return `${where[0].toUpperCase() + where.slice(1)} orders between 10pm and 4am: at most ${n} a month`;
  return `${where[0].toUpperCase() + where.slice(1)} orders containing tobacco: at most ${n} a month`;
}

/** Starter goals derived from the user's own history: budget at their 75th-percentile month, order cap ~15% under their average. */
export function suggestGoals(orders: Order[], now = new Date()): Omit<Goal, "id">[] {
  const out: Omit<Goal, "id">[] = [];
  const months = byMonth(orders);
  const first = orders.reduce((m, o) => Math.min(m, new Date(o.placedAt).getTime()), Infinity);
  const firstMonth = isFinite(first) ? monthKey(new Date(first)) : monthKey(now);
  const keys: string[] = [];
  for (let n = 12; n >= 1; n--) { const k = monthKey(addMonths(now, -n)); if (k >= firstMonth) keys.push(k); }
  if (!keys.length) return out;
  const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);
  for (const scope of ["grocery", "food"] as const) {
    const spend = keys.map((k) => metricValue(months.get(k) ?? [], { scope, metric: "spend" })).sort((a, b) => a - b);
    const cnt = keys.map((k) => metricValue(months.get(k) ?? [], { scope, metric: "orders" }));
    if (!spend.some((s) => s > 0)) continue;
    const p75 = spend[Math.min(spend.length - 1, Math.floor(spend.length * 0.75))];
    out.push({ label: `${scope === "food" ? "Food delivery" : "Groceries"} budget`, scope, metric: "spend", limit: roundTo(p75, 500) });
    const avg = cnt.reduce((a, b) => a + b, 0) / cnt.length;
    out.push({ label: `${scope === "food" ? "Food" : "Grocery"} order cap`, scope, metric: "orders", limit: Math.max(1, Math.round(avg * 0.85)) });
    const small = keys.map((k) => metricValue(months.get(k) ?? [], { scope, metric: "small_orders", threshold: 200 })).reduce((a, b) => a + b, 0) / keys.length;
    if (small >= 1) out.push({ label: `${scope === "food" ? "Food" : "Grocery"} orders under ₹200`, scope, metric: "small_orders", threshold: 200, limit: Math.max(1, Math.floor(small / 2)) });
  }
  const toba = keys.map((k) => metricValue(months.get(k) ?? [], { scope: "grocery", metric: "tobacco_orders" })).reduce((a, b) => a + b, 0) / keys.length;
  if (toba >= 1) out.push({ label: "Orders with tobacco", scope: "grocery", metric: "tobacco_orders", limit: Math.max(0, Math.floor(toba * 0.7)) });
  return out;
}

export interface Tip { tone: "warn" | "info" | "good"; text: string }

/** Dynamic observations that change as orders change. Rules are cheap and explainable; nothing here is a model. */
export function smartTips(orders: Order[], now = new Date()): Tip[] {
  const tips: Tip[] = [];
  const DAY = 86400000;
  const recent = orders.filter((o) => now.getTime() - new Date(o.placedAt).getTime() <= 30 * DAY);
  const months = byMonth(orders);
  const cur = monthKey(now);
  const prev3 = [1, 2, 3].map((n) => monthKey(addMonths(now, -n)));

  // Small orders this month vs recent norm
  for (const scope of ["grocery", "food"] as const) {
    const cm = metricValue(months.get(cur) ?? [], { scope, metric: "small_orders", threshold: 200 });
    const avg = prev3.reduce((s, k) => s + metricValue(months.get(k) ?? [], { scope, metric: "small_orders", threshold: 200 }), 0) / 3;
    if (cm >= 3 && cm > avg) tips.push({ tone: "warn", text: `${cm} ${scope} orders under ₹200 this month (usual ${avg.toFixed(1)}). Small carts pay the most in fees per rupee, so batch them.` });
  }

  // Grocery items re-ordered often (subscription / bulk candidates)
  const counts = new Map<string, number>();
  for (const o of recent) if (o.type === "grocery") for (const n of new Set(o.items.map((i) => i.name))) counts.set(n, (counts.get(n) ?? 0) + 1);
  const rep = [...counts.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 2);
  for (const [n, c] of rep) tips.push({ tone: "info", text: `${n} ordered in ${c} separate orders in the last 30 days. Folding it into one planned order (or a subscription, if offered) saves repeat delivery and handling fees.` });

  // Repeat restaurant
  const vend = new Map<string, number>();
  for (const o of recent) if (o.type === "food") vend.set(o.vendor, (vend.get(o.vendor) ?? 0) + 1);
  const tv = [...vend.entries()].sort((a, b) => b[1] - a[1])[0];
  if (tv && tv[1] >= 4) tips.push({ tone: "info", text: `${tv[1]} orders from ${tv[0]} in the last 30 days. Ordering direct from them, or cooking the repeat dish at home, may be cheaper.` });

  // Late-night food share
  const food = recent.filter((o) => o.type === "food");
  const late = food.filter((o) => { const h = new Date(o.placedAt).getHours(); return h >= 22 || h < 4; });
  if (food.length >= 5 && late.length / food.length >= 0.3) tips.push({ tone: "warn", text: `${Math.round((late.length / food.length) * 100)}% of your food orders in the last 30 days were between 10pm and 4am.` });

  // Spending pace vs typical month
  for (const scope of ["grocery", "food"] as const) {
    const hist = [1, 2, 3, 4, 5, 6].map((n) => metricValue(months.get(monthKey(addMonths(now, -n))) ?? [], { scope, metric: "spend" })).filter((v) => v > 0).sort((a, b) => a - b);
    if (hist.length < 3) continue;
    const median = hist[Math.floor(hist.length / 2)];
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const pace = metricValue(months.get(cur) ?? [], { scope, metric: "spend" }) / (Math.max(1, now.getDate()) / dim);
    if (now.getDate() >= 7 && pace > median * 1.25) tips.push({ tone: "warn", text: `${scope === "food" ? "Food" : "Grocery"} spend is on pace for ₹${Math.round(pace).toLocaleString("en-IN")} this month, ${Math.round((pace / median - 1) * 100)}% above your usual ₹${Math.round(median).toLocaleString("en-IN")}.` });
    else if (now.getDate() >= 7 && pace < median * 0.8) tips.push({ tone: "good", text: `${scope === "food" ? "Food" : "Grocery"} spend is on pace for ₹${Math.round(pace).toLocaleString("en-IN")}, ${Math.round((1 - pace / median) * 100)}% below your usual. Keep it up.` });
  }
  return tips;
}
