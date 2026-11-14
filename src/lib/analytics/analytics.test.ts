import { describe, expect, it } from "vitest";
import { applyFilters, emptyFilters, kpis, topItems, byCount, bySpend, categorySpend, itemDetail } from "./index";
import type { Order } from "../types";
import { generateSample } from "../sample";

const orders = generateSample();

describe("analytics", () => {
  it("totals match across groupings", () => {
    const k = kpis(orders);
    expect(k.orders).toBe(370);
    for (const o of orders) expect(o.total).toBe(o.itemTotal + o.fees - o.discount + o.tip);
  });
  it("filters by platform and type", () => {
    const z = applyFilters(orders, { ...emptyFilters, platforms: ["zomato"] });
    expect(z.every((o) => o.platform === "zomato")).toBe(true);
    expect(applyFilters(orders, { ...emptyFilters, type: "grocery" }).every((o) => o.type === "grocery")).toBe(true);
  });
  it("filters by date range", () => {
    const r = applyFilters(orders, { ...emptyFilters, from: "2026-10-01", to: "2026-10-31" });
    expect(r.every((o) => o.placedAt.startsWith("2026-10"))).toBe(true);
  });
  it("category filter narrows items", () => {
    const r = applyFilters(orders, { ...emptyFilters, categories: ["Dairy & Eggs"] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((o) => o.items.every((i) => i.category === "Dairy & Eggs"))).toBe(true);
  });
  it("ranks items by count and spend", () => {
    const items = topItems(orders);
    expect(items.sort(byCount)[0].count).toBeGreaterThanOrEqual(items[1].count);
    expect(items.sort(bySpend)[0].spend).toBeGreaterThanOrEqual(items[1].spend);
  });
  it("category spend sums to item spend", () => {
    const a = categorySpend(orders).reduce((s, c) => s + c.value, 0);
    expect(a).toBe(orders.reduce((s, o) => s + o.itemTotal, 0));
  });
});

describe("unpriced orders and drill-down", () => {
  const mk = (id: string, at: string, total: number, items: [string, number][]): Order => ({
    id, platform: "zomato", type: "food", placedAt: at, vendor: "Cafe", itemTotal: total, fees: 0, discount: 0, tip: 0, total, itemsPriced: false,
    items: items.map(([n, q]) => ({ name: n, rawName: n, qty: q, unitPrice: 0, category: "x" })),
  });
  const os = [
    mk("1", "2026-01-01T07:00:00Z", 100, [["Tea", 1]]),
    mk("2", "2026-01-11T07:00:00Z", 300, [["Tea", 1], ["Cake", 2]]),
    mk("3", "2026-01-21T07:00:00Z", 100, [["Tea", 2]]),
  ];
  it("shares order totals across item units and flags them estimated", () => {
    const tea = topItems(os).find((r) => r.name === "Tea")!;
    expect(tea).toMatchObject({ count: 4, orders: 3, spend: 100 + 100 + 100, estimated: 300 });
    expect(topItems(os).find((r) => r.name === "Cake")!.spend).toBe(200);
  });
  it("itemDetail: frequency, time buckets, platforms", () => {
    const d = itemDetail(os, "Tea")!;
    expect(d).toMatchObject({ units: 4, orders: 3, avgGapDays: 10 });
    expect(d.byHour.reduce((a, b) => a + b, 0)).toBe(4);
    expect(d.platforms[0]).toMatchObject({ key: "zomato", units: 4 });
    expect(d.recent[0].id).toBe("3");
    expect(itemDetail(os, "Nope")).toBeNull();
  });
});
