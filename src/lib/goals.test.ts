import { describe, expect, it } from "vitest";
import { goalProgress, metricValue, smartTips, SENSITIVE, recentAverage, suggestGoals, type Goal } from "./goals";
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
  it("suggests limits equal to the last 2 full months' average", () => {
    // Sep food = 400, Oct food = 950 -> avg 675 -> rounds to 700; orders (1 + 3) / 2 = 2
    expect(recentAverage(orders, { scope: "food", metric: "spend" }, 2, NOW)).toBe(675);
    const s = suggestGoals(orders, NOW);
    expect(s.find((g) => g.scope === "food" && g.metric === "spend")?.limit).toBe(700);
    expect(s.find((g) => g.scope === "food" && g.metric === "orders")?.limit).toBe(2);
  });
  it("never suggests or mentions habit goals", () => {
    const habit = [
      ...Array.from({ length: 6 }, (_, k) => order(at(10, 1 + k), "grocery", 900, "Tobacco")),
      ...Array.from({ length: 6 }, (_, k) => order(at(9, 1 + k * 3), "grocery", 900, "Tobacco")),
      ...Array.from({ length: 6 }, (_, k) => order(at(10, 1 + k, 23), "food", 300)),
    ];
    expect(suggestGoals(habit, NOW).some((g) => g.metric === "tobacco_orders" || g.metric === "late_night")).toBe(false);
    const tips = smartTips(habit, NOW).map((t) => t.text).join(" ");
    expect(tips).not.toMatch(/10pm|late/i);
    for (const t of smartTips(habit, NOW)) for (const c of SENSITIVE) expect(t.text).not.toContain(c);
    // an ordinary repeated item still gets a tip, and a Tobacco item with the same name does not
    const milk = Array.from({ length: 4 }, (_, k) => order(at(10, 2 + k), "grocery", 60));
    expect(smartTips(milk, NOW).some((t) => t.text.includes("Milk"))).toBe(true);
    expect(smartTips(habit.filter((o) => o.type === "grocery"), NOW).some((t) => t.text.includes("Milk"))).toBe(false);
  });
  it("tips do not throw on empty data", () => { expect(smartTips([], NOW)).toEqual([]); });
});
