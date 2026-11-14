import { describe, expect, it } from "vitest";
import { monthlyPlan, roundUp } from "./plan";
import type { Order } from "./types";

let n = 0;
const o = (iso: string, type: "food" | "grocery", total: number): Order => ({ id: String(n++), platform: type === "food" ? "zomato" : "blinkit", type, placedAt: iso, vendor: "V", itemTotal: total, fees: 0, discount: 0, tip: 0, total, items: [] });
const at = (m: number, d = 5) => new Date(2026, m, d, 12).toISOString();
const NOW = new Date(2026, 10, 15, 12); // 15 Nov 2026

describe("monthlyPlan", () => {
  const orders = [
    o(at(7), "food", 3000), o(at(7), "grocery", 9000),   // Aug 12,000
    o(at(8), "food", 4000), o(at(8), "grocery", 12000),  // Sep 16,000
    o(at(9), "food", 5000), o(at(9), "grocery", 18000),  // Oct 23,000
    o(at(10), "food", 1000), o(at(10), "grocery", 5000), // Nov so far 6,000 (not part of the average)
    o(at(6), "grocery", 99999),                          // July: older than 3 months, ignored
  ];
  const p = monthlyPlan(orders, NOW);
  it("uses the last 3 full months, not the current or older ones", () => {
    expect(p.months.map((m) => m.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(p.tight).toMatchObject({ food: 4000, grocery: 13000, total: 17000 });
    expect(p.safe).toMatchObject({ food: 5000, grocery: 18000, total: 23000 });
  });
  it("recommends average plus half the gap to the busiest month, rounded up per type", () => {
    expect(p.recommended.food).toBe(4500);     // 4000 + 0.5*(5000-4000)
    expect(p.recommended.grocery).toBe(15500); // 13000 + 0.5*(18000-13000) = 15500
    expect(p.recommended.total).toBe(20000);
    expect(p.buffer).toBe(3000);
    expect(p.recommended.total).toBeGreaterThanOrEqual(p.tight.total);
    expect(p.recommended.total).toBeLessThanOrEqual(p.safe.total + 500);
  });
  it("tracks this month against the recommendation", () => {
    expect(p.thisMonth.total).toBe(6000);
    expect(p.left).toBe(14000);
    expect(p.weekly).toBeCloseTo(20000 / 4.3);
    expect(p.short).toBe(false);
  });
  it("copes with a short history and with nothing", () => {
    const two = monthlyPlan([o(at(8), "food", 1000), o(at(9), "grocery", 2000)], NOW);
    expect(two.months).toHaveLength(2);
    expect(two.short).toBe(true);
    expect(monthlyPlan([], NOW)).toMatchObject({ months: [], recommended: { total: 0 }, short: true });
  });
  it("rounds to tidy amounts", () => {
    expect(roundUp(4010)).toBe(4100);
    expect(roundUp(5001)).toBe(5500);
    expect(roundUp(0)).toBe(0);
  });
});
