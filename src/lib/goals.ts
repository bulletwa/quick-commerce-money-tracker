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
/** Categories the app never singles out in suggestions or tips. You can still add goals about them yourself. */
export const SENSITIVE = ["Tobacco", "Health & Pharmacy"];
/** Goal types about personal habits: available in the form, never suggested. */
export const HABIT_METRICS: Metric[] = ["late_night", "tobacco_orders"];
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

/** Average of a metric over the previous `n` full months (months before the user's first order are skipped). */
export function recentAverage(orders: Order[], g: Pick<Goal, "scope" | "metric" | "threshold">, n = 2, now = new Date()): number {
  const months = byMonth(orders);
  const first = orders.reduce((m, o) => Math.min(m, new Date(o.placedAt).getTime()), Infinity);
  const firstMonth = isFinite(first) ? monthKey(new Date(first)) : monthKey(now);
  const vals: number[] = [];
  for (let i = 1; i <= n; i++) { const k = monthKey(addMonths(now, -i)); if (k >= firstMonth) vals.push(metricValue(months.get(k) ?? [], g)); }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/** Limit that matches the recent average: rupees round to the nearest ₹100, counts to a whole order. */
export function limitFromAverage(metric: Metric, avg: number) {
  return metric === "spend" ? Math.max(100, Math.round(avg / 100) * 100) : Math.max(0, Math.round(avg));
}

/** Starter goals: each limit equals the average of the last 2 full months, so it starts as "keep doing what you did, no worse". */
export function suggestGoals(orders: Order[], now = new Date()): Omit<Goal, "id">[] {
  const out: Omit<Goal, "id">[] = [];
  const avg = (scope: Scope, metric: Metric, threshold?: number) => recentAverage(orders, { scope, metric, threshold }, 2, now);
  for (const scope of ["grocery", "food"] as const) {
    const name = scope === "food" ? "Food delivery" : "Groceries";
    if (avg(scope, "spend") <= 0) continue;
    out.push({ label: `${name} budget`, scope, metric: "spend", limit: limitFromAverage("spend", avg(scope, "spend")) });
    out.push({ label: `${scope === "food" ? "Food" : "Grocery"} order cap`, scope, metric: "orders", limit: Math.max(1, limitFromAverage("orders", avg(scope, "orders"))) });
    const small = avg(scope, "small_orders", 200);
    if (small >= 0.5) out.push({ label: `${scope === "food" ? "Food" : "Grocery"} orders under ₹200`, scope, metric: "small_orders", threshold: 200, limit: Math.max(1, limitFromAverage("small_orders", small)) });
  }
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
  for (const o of recent) if (o.type === "grocery") for (const n of new Set(o.items.filter((i) => !SENSITIVE.includes(i.category)).map((i) => i.name))) counts.set(n, (counts.get(n) ?? 0) + 1);
  const rep = [...counts.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 2);
  for (const [n, c] of rep) tips.push({ tone: "info", text: `${n} ordered in ${c} separate orders in the last 30 days. Folding it into one planned order (or a subscription, if offered) saves repeat delivery and handling fees.` });

  // Repeat restaurant
  const vend = new Map<string, number>();
  for (const o of recent) if (o.type === "food") vend.set(o.vendor, (vend.get(o.vendor) ?? 0) + 1);
  const tv = [...vend.entries()].sort((a, b) => b[1] - a[1])[0];
  if (tv && tv[1] >= 4) tips.push({ tone: "info", text: `${tv[1]} orders from ${tv[0]} in the last 30 days. Ordering direct from them, or cooking the repeat dish at home, may be cheaper.` });

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

/** Validates an untrusted goal object (from the API or a backup file). Returns null when anything is off. */
export function parseGoal(b: unknown): Goal | null {
  if (!b || typeof b !== "object") return null;
  const x = b as Record<string, unknown>;
  const limit = Number(x.limit);
  const threshold = x.threshold == null ? undefined : Number(x.threshold);
  if (!SCOPES.includes(x.scope as Scope) || !METRICS.includes(x.metric as Metric)) return null;
  if (!Number.isFinite(limit) || limit < 0 || limit > 1e7) return null;
  if (threshold != null && (!Number.isFinite(threshold) || threshold < 0 || threshold > 1e6)) return null;
  const label = String(x.label ?? "").trim().slice(0, 80);
  if (!label) return null;
  const id = typeof x.id === "string" && /^[\w-]{1,40}$/.test(x.id) ? x.id : crypto.randomUUID();
  return { id, label, scope: x.scope as Scope, metric: x.metric as Metric, limit, ...(x.metric === "small_orders" ? { threshold: threshold ?? 200 } : {}) };
}
