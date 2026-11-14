import { describe, expect, it } from "vitest";
import { allocate, confidence, parsePrice, reconcile, withAmounts } from "./amounts";
import { applyFilters, emptyFilters, kpis, topItems } from "./index";
import type { Order } from "../types";

const line = (name: string, category: string, qty: number, unitPrice = 0) => ({ name, rawName: name, qty, unitPrice, category });
const base = { vendor: "Blinkit", fees: 0, discount: 0, tip: 0, placedAt: "2026-10-05T12:00:00.000Z" } as const;
// ₹1,000 basket: 1 pack of cigarettes, 4 vegetables (nobody tells us the prices)
const mixed: Order = { ...base, id: "m", platform: "blinkit", type: "grocery", itemTotal: 1000, total: 1000, itemsPriced: false,
  items: [line("Marlboro Gold Advance", "Tobacco", 1), line("Onion", "Fruits & Vegetables", 2), line("Tomato", "Fruits & Vegetables", 2)] };
const swiggy: Order = { ...base, id: "s", platform: "swiggy", type: "food", vendor: "Cafe", itemTotal: 300, fees: 30, discount: 10, total: 320,
  items: [line("Dosa", "Indian Mains", 2, 100), line("Coffee", "Beverages", 1, 100)] };
const sum = (o: Order) => o.items.reduce((s, i) => s + (i.amount ?? 0), 0);

describe("allocate", () => {
  it("exact for platforms that give item prices", () => {
    const o = allocate(swiggy);
    expect(o.items.every((i) => i.basis === "exact")).toBe(true);
    expect(sum(o)).toBe(300);
  });
  it("estimates equally per unit when nothing is known, and always adds up to the total", () => {
    const o = allocate(mixed);
    expect(o.items.every((i) => i.basis === "estimated")).toBe(true);
    expect(sum(o)).toBeCloseTo(1000);
    expect(o.items[0].amount).toBeCloseTo(200); // 1 of 5 units
  });
  it("uses entered prices and shares only the rest", () => {
    const o = allocate(mixed, { "Marlboro Gold Advance": 400 });
    expect(o.items[0]).toMatchObject({ amount: 400, basis: "entered" });
    expect(o.items[1].amount).toBeCloseTo(300); // (1000-400)/4 units * 2 units
    expect(sum(o)).toBeCloseTo(1000);
  });
  it("caps entered prices that exceed the order, and scales up when every item is priced", () => {
    expect(sum(allocate(mixed, { "Marlboro Gold Advance": 5000 }))).toBeCloseTo(1000);
    const all = allocate(mixed, { "Marlboro Gold Advance": 400, Onion: 100, Tomato: 100 }); // 400+200+200 = 800 of 1000
    expect(sum(all)).toBeCloseTo(1000);
    expect(all.items[0].amount).toBeCloseTo(500);
  });
  it("adds up exactly even with many lines that don't divide evenly", () => {
    const many: Order = { ...mixed, id: "many", total: 100.01, itemTotal: 100.01, items: Array.from({ length: 7 }, (_, k) => line(`Item ${k}`, "Snacks", 1)) };
    expect(sum(allocate(many))).toBeCloseTo(100.01, 10);
    expect(sum(allocate(many, { "Item 0": 33.33 }))).toBeCloseTo(100.01, 10);
  });
  it("does not touch an already allocated order", () => {
    const o = allocate(mixed);
    expect(allocate(o, { Onion: 1 })).toBe(o);
  });
});

describe("category filter with unknown prices", () => {
  const f = { ...emptyFilters, categories: ["Tobacco"] };
  it("brackets the answer: confirmed 0, best guess 1 unit in 5, never above the whole basket", () => {
    const [o] = applyFilters(withAmounts([mixed]), f);
    expect(o.total).toBeCloseTo(200);
    expect(o.lo).toBe(0);
    expect(o.hi).toBeCloseTo(1000); // all unknown amounts could belong to the cigarettes
    expect(o.lo! <= o.total && o.total <= o.hi!).toBe(true);
    const c = confidence([o]);
    expect(c.low).toBe(0); expect(c.high).toBeCloseTo(1000); expect(c.estimatedOrders).toBe(1);
  });
  it("collapses to an exact number once the selected item has a price", () => {
    const [o] = applyFilters(withAmounts([mixed], { "Marlboro Gold Advance": 380 }), f);
    expect(o.total).toBeCloseTo(380);
    expect(o.lo).toBeCloseTo(380); expect(o.hi).toBeCloseTo(380);
    expect(confidence([o]).exactOrders).toBe(1);
  });
  it("a priced selection beats the equal-per-unit guess in KPIs and item spend", () => {
    const guess = kpis(applyFilters(withAmounts([mixed]), f)).total;
    const priced = kpis(applyFilters(withAmounts([mixed], { "Marlboro Gold Advance": 380 }), f)).total;
    expect(priced).toBeGreaterThan(guess);
    expect(topItems(withAmounts([mixed], { "Marlboro Gold Advance": 380 })).find((i) => i.name === "Marlboro Gold Advance")!.spend).toBeCloseTo(380);
  });
  it("priced (Swiggy) orders stay exact under a filter", () => {
    const [o] = applyFilters(withAmounts([swiggy]), { ...emptyFilters, categories: ["Indian Mains"] });
    expect(o.lo).toBeCloseTo(o.hi!);
    expect(o.total).toBeCloseTo(320 * (200 / 300));
  });
});

describe("reconcile and parsePrice", () => {
  it("category amounts add up to the item cost of the orders", () => {
    const r = reconcile([mixed, swiggy], { Onion: 50 });
    expect(r.ok).toBe(true);
    expect(r.categories).toBeCloseTo(1300);
    expect(r.paid).toBe(1320);
  });
  it("holds when a platform's item prices differ from its reported item total", () => {
    const odd: Order = { ...swiggy, id: "odd", itemTotal: 250 }; // items add up to 300
    expect(reconcile([odd]).ok).toBe(true);
  });
  it("validates prices", () => {
    expect(parsePrice("Milk", 27.456)).toEqual({ name: "Milk", price: 27.46 });
    expect(parsePrice("Milk", null)).toEqual({ name: "Milk", price: null });
    for (const bad of [0, -5, NaN, "abc", 1e9]) expect(parsePrice("Milk", bad)).toBeNull();
    expect(parsePrice("", 5)).toBeNull();
  });
});
