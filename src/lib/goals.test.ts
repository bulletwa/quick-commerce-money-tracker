import { describe, expect, it } from "vitest";
import { goalProgress, metricValue, smartTips, suggestGoals, type Goal } from "./goals";
import type { Order } from "./types";

let n = 0;
const order = (iso: string, type: "food" | "grocery", total: number, cat = "Dairy & Eggs"): Order => ({
  id: String(n++), platform: type === "food" ? "zomato" : "blinkit", type, placedAt: iso, vendor: "V", itemTotal: total, fees: 0, discount: 0, tip: 0, total,
  items: [{ name: "Milk", rawName: "Milk", qty: 1, unitPrice: total, category: cat }],
});
const NOW = new Date(2026, 10, 15, 12); // 15 Nov 2026, local
const at = (m: number, d: number, h = 12) => new Date(2026, m, d, h).toISOString();

describe("goals", () => {
  const orders = [
    order(at(9, 3), "food", 300), order(at(9, 9), "food", 150), order(at(9, 20, 23), "food", 500), // Oct: 950, 3 orders, 1 small, 1 late
    order(at(8, 5), "food", 400), // Sep
    order(at(10, 2), "food", 250), order(at(10, 4), "food", 100), // Nov so far
    order(at(10, 5), "grocery", 900, "Tobacco"),
  ];
  it("computes metrics per scope", () => {
    expect(metricValue(orders.filter((o) => o.placedAt >= at(9, 1) && o.placedAt < at(10, 1)), { scope: "food", metric: "spend" })).toBe(950);
    expect(metricValue(orders, { scope: "food", metric: "small_orders", threshold: 200 })).toBe(2);
    expect(metricValue(orders, { scope: "food", metric: "late_night" })).toBe(1);
    expect(metricValue(orders, { scope: "grocery", metric: "tobacco_orders" })).toBe(1);
    expect(metricValue(orders, { scope: "all", metric: "orders" })).toBe(7);
  });
  it("reports progress, state, projection and streak", () => {
    const g: Goal = { id: "g", label: "Food", scope: "food", metric: "spend", limit: 400 };
    const p = goalProgress(g, orders, NOW);
    expect(p.value).toBe(350);
    expect(p.state).toBe("warn"); // 87.5%
    expect(p.projected).toBeCloseTo(350 / (15 / 30));
    expect(p.history.map((h) => [h.month, h.value])).toEqual([["2026-09", 400], ["2026-10", 950]]);
    expect(p.streak).toBe(0); // October was over
    expect(goalProgress({ ...g, limit: 300 }, orders, NOW).state).toBe("over");
    expect(goalProgress({ ...g, limit: 5000 }, orders, NOW).state).toBe("ok");
  });
  it("suggests nothing without history and something with it", () => {
    expect(suggestGoals([], NOW)).toEqual([]);
    expect(suggestGoals(orders, NOW).some((s) => s.scope === "food" && s.metric === "spend")).toBe(true);
  });
  it("tips do not throw on empty data", () => { expect(smartTips([], NOW)).toEqual([]); });
});
