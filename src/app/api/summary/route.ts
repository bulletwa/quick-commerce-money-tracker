import { listGoals, listOrders } from "@/lib/db";
import { goalProgress, metricValue, monthKey, smartTips } from "@/lib/goals";
import { hostOk } from "@/lib/token";
export const dynamic = "force-dynamic";

/** Compact month-to-date summary for the extension popup and badge. */
export async function GET(req: Request) {
  if (!hostOk(req)) return new Response("forbidden", { status: 403 });
  const now = new Date();
  const { orders } = listOrders();
  const month = orders.filter((o) => monthKey(new Date(o.placedAt)) === monthKey(now));
  const goals = listGoals().map((g) => goalProgress(g, orders, now));
  return Response.json({
    month: monthKey(now),
    food: { spend: metricValue(month, { scope: "food", metric: "spend" }), orders: metricValue(month, { scope: "food", metric: "orders" }) },
    grocery: { spend: metricValue(month, { scope: "grocery", metric: "spend" }), orders: metricValue(month, { scope: "grocery", metric: "orders" }) },
    goals: goals.map((p) => ({ id: p.goal.id, label: p.goal.label, metric: p.goal.metric, value: p.value, limit: p.goal.limit, pct: p.pct, state: p.state })),
    over: goals.filter((p) => p.state === "over").length,
    warn: goals.filter((p) => p.state === "warn").length,
    tips: smartTips(orders, now).slice(0, 3).map((t) => t.text),
  });
}
