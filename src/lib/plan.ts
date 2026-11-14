import { byMonth, metricValue, monthKey } from "./goals";
import type { Order } from "./types";

export interface PlanMonth { month: string; food: number; grocery: number; total: number }
export interface Split { food: number; grocery: number; total: number }

export interface Plan {
  months: PlanMonth[]; // the full months used, oldest first (up to 3)
  tight: Split; // the average of those months
  recommended: Split; // average plus half the gap to the busiest month, rounded up
  safe: Split; // the busiest month of each kind
  buffer: number; // recommended.total - tight.total
  thisMonth: Split; // spent so far this month
  left: number; // recommended.total - thisMonth.total (negative = already past it)
  weekly: number; // recommended / 4.3
  short: boolean; // fewer than 3 full months of history
}

/** Round up to a tidy amount: ₹100 below ₹5,000, ₹500 above. */
export const roundUp = (n: number) => { const step = n < 5000 ? 100 : 500; return Math.ceil(Math.max(0, n) / step) * step; };

/**
 * How much to put aside at the start of a month, from the last `n` full months of spending.
 * Recommended = average + half the distance to your busiest month, so an ordinary spike is covered without
 * locking up the money of your worst month. Food and groceries are planned separately and added up.
 */
export function monthlyPlan(orders: Order[], now = new Date(), n = 3): Plan {
  const m = byMonth(orders);
  const first = orders.reduce((a, o) => Math.min(a, new Date(o.placedAt).getTime()), Infinity);
  const firstMonth = isFinite(first) ? monthKey(new Date(first)) : monthKey(now);
  const months: PlanMonth[] = [];
  for (let i = n; i >= 1; i--) {
    const key = monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1));
    if (key < firstMonth) continue;
    const os = m.get(key) ?? [];
    const food = metricValue(os, { scope: "food", metric: "spend" }), grocery = metricValue(os, { scope: "grocery", metric: "spend" });
    months.push({ month: key, food, grocery, total: food + grocery });
  }
  const stat = (pick: (p: PlanMonth) => number) => {
    const xs = months.map(pick);
    const avg = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0, max = xs.length ? Math.max(...xs) : 0;
    return { avg, max, rec: roundUp(avg + 0.5 * (max - avg)) };
  };
  const f = stat((p) => p.food), g = stat((p) => p.grocery), t = stat((p) => p.total);
  const cur = m.get(monthKey(now)) ?? [];
  const food = metricValue(cur, { scope: "food", metric: "spend" }), grocery = metricValue(cur, { scope: "grocery", metric: "spend" });
  const recommended = { food: f.rec, grocery: g.rec, total: f.rec + g.rec };
  return {
    months,
    tight: { food: f.avg, grocery: g.avg, total: t.avg },
    recommended,
    safe: { food: f.max, grocery: g.max, total: t.max },
    buffer: Math.max(0, recommended.total - t.avg),
    thisMonth: { food, grocery, total: food + grocery },
    left: recommended.total - (food + grocery),
    weekly: recommended.total / 4.3,
    short: months.length < n,
  };
}
