import { describe, expect, it } from "vitest";
import { applyFilters, emptyFilters, filterParts, kpis, paidTotal, periodLabel, spendOverTime, groupSum, topItems, byCount, bySpend, categorySpend, itemDetail } from "./index";
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

describe("category filter prorates order money", () => {
  const line = (name: string, category: string, qty: number, unitPrice: number) => ({ name, rawName: name, qty, unitPrice, category });
  const base = { vendor: "V", fees: 20, discount: 10, tip: 0, placedAt: "2026-10-05T12:00:00.000Z" } as const;
  const priced: Order = { ...base, id: "p", platform: "swiggy", type: "food", itemTotal: 400, total: 410, items: [line("Milk", "Dairy & Eggs", 1, 100), line("Rice", "Staples", 1, 300)] };
  const unpriced: Order = { ...base, id: "u", platform: "blinkit", type: "grocery", itemTotal: 600, total: 600, fees: 0, discount: 0, itemsPriced: false, items: [line("Milk", "Dairy & Eggs", 1, 0), line("Eggs", "Dairy & Eggs", 1, 0), line("Soap", "Personal Care & Beauty", 2, 0)] };
  const only: Order = { ...base, id: "o", platform: "zomato", type: "food", itemTotal: 200, total: 200, fees: 0, discount: 0, items: [line("Curd", "Dairy & Eggs", 2, 100)] };
  const all = [priced, unpriced, only];
  const f = { ...emptyFilters, categories: ["Dairy & Eggs"] };

  it("totals follow the selected items, not the whole basket", () => {
    const r = applyFilters(all, f);
    expect(r).toHaveLength(3);
    expect(r.find((o) => o.id === "p")!.total).toBeCloseTo(410 * 0.25); // 100 of 400 in item prices
    expect(r.find((o) => o.id === "u")!.total).toBeCloseTo(600 * 0.5); // 2 of 4 units
    expect(kpis(r).total).toBeLessThan(kpis(all).total);
    expect(kpis(r).total).toBeCloseTo(102.5 + 300 + 200);
    expect(paidTotal(r)).toBe(410 + 600 + 200); // what was really paid stays available
  });
  it("order made only of selected items is untouched", () => {
    const o = applyFilters(all, f).find((x) => x.id === "o")!;
    expect(o.partial).toBeUndefined();
    expect(o.total).toBe(200);
  });
  it("charts built from totals agree with the KPI", () => {
    const r = applyFilters(all, f);
    const total = kpis(r).total;
    expect(spendOverTime(r, "month").reduce((s, m) => s + m.food + m.grocery, 0)).toBeCloseTo(total);
    expect(groupSum(r, (o) => o.platform).reduce((s, g) => s + g.value, 0)).toBeCloseTo(total);
  });
  it("item spend is unchanged by the proration", () => {
    const before = topItems(applyFilters(all, { ...emptyFilters, categories: ["Dairy & Eggs"] })).find((i) => i.name === "Milk");
    const unfiltered = topItems(all).filter((i) => i.name === "Milk").reduce((s, i) => s + i.spend, 0);
    expect(before!.spend).toBeCloseTo(unfiltered);
  });
  it("min/max order filter uses the real order size", () => {
    expect(applyFilters(all, { ...f, minTotal: 500 }).map((o) => o.id)).toEqual(["u"]);
  });
  it("describes the period and filters", () => {
    const r = applyFilters(all, f);
    expect(periodLabel(emptyFilters, r)).toMatch(/^All time \(Oct 2026 – Oct 2026\)$/);
    expect(periodLabel({ ...emptyFilters, from: "2026-10-01", to: "2026-10-31" }, r)).toBe("1 Oct 2026 – 31 Oct 2026");
    const now = new Date("2026-11-14T10:00:00Z");
    expect(periodLabel({ ...emptyFilters, from: "2026-10-15", to: "2026-11-14" }, r, now)).toBe("Last 30 days");
    expect(periodLabel({ ...emptyFilters, from: "2026-10-01" }, r)).toBe("1 Oct 2026 – 5 Oct 2026");
    expect(periodLabel(emptyFilters, [])).toBe("No orders in this selection");
    expect(filterParts({ ...f, platforms: ["zomato"], type: "food" })).toEqual(["Dairy & Eggs", "Zomato", "Food"]);
  });
});
