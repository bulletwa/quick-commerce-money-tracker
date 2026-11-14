import type { Order, OrderItem } from "../types";

/** How well one item's amount is known. */
export type Basis = "exact" | "entered" | "estimated";
/** What the user says they usually pay per unit, keyed by normalised item name (OrderItem.name). */
export type Prices = Record<string, number>;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Give every item an `amount` (rupees) and a `basis`, so each order's item amounts add up to what was paid for items:
 *  - exact: the platform reported the item price (Swiggy).
 *  - entered: the user supplied a unit price. Entered prices are scaled down if they would add up to more than the order total,
 *    and scaled up when every item has one, so nothing is invented or lost.
 *  - estimated: no price known. What is left of the order total after exact/entered items is shared equally per unit.
 */
export function allocate(o: Order, prices: Prices = {}): Order {
  if (!o.items.length || o.items.every((i) => i.amount != null && i.basis)) return o;
  if (o.itemsPriced !== false) {
    return { ...o, items: o.items.map((i): OrderItem => ({ ...i, amount: r2(i.qty * i.unitPrice), basis: "exact" })) };
  }
  const budget = o.total;
  const known = o.items.map((i) => (prices[i.name] != null && prices[i.name] > 0 ? i.qty * prices[i.name] : 0));
  const sumKnown = known.reduce((a, b) => a + b, 0);
  const unknownUnits = o.items.reduce((a, i, k) => a + (known[k] ? 0 : i.qty), 0);
  // all items priced by the user: spread the (small) difference, e.g. fees, proportionally; too much: scale down
  const scale = sumKnown > 0 && (sumKnown > budget || unknownUnits === 0) ? budget / sumKnown : 1;
  const remainder = Math.max(0, budget - sumKnown * scale);
  const amounts = o.items.map((i, k) => (known[k] ? known[k] * scale : unknownUnits ? (remainder * i.qty) / unknownUnits : 0)).map(r2);
  // rounding each line to paise can leave the order a few paise off: give the difference to the largest line so it adds up exactly
  const drift = r2(budget - amounts.reduce((a, b) => a + b, 0));
  if (drift && amounts.length) amounts[amounts.indexOf(Math.max(...amounts))] = r2(amounts[amounts.indexOf(Math.max(...amounts))] + drift);
  return { ...o, items: o.items.map((i, k): OrderItem => ({ ...i, amount: amounts[k], basis: known[k] ? "entered" : "estimated" })) };
}

export const withAmounts = (orders: Order[], prices: Prices = {}) => orders.map((o) => allocate(o, prices));

export interface Confidence {
  total: number; // best estimate for the selection
  confirmed: number; // part that is exact or entered by the user
  low: number; high: number; // the selection cannot be below/above these
  estimatedOrders: number; // orders whose selected part is not fully known
  exactOrders: number;
}

/** How sure we are about the money in a (possibly category-filtered) set of orders. */
export function confidence(orders: Order[]): Confidence {
  const c: Confidence = { total: 0, confirmed: 0, low: 0, high: 0, estimatedOrders: 0, exactOrders: 0 };
  for (const o of orders) {
    c.total += o.total;
    if (o.partial && o.lo != null && o.hi != null) {
      c.confirmed += o.lo; c.low += o.lo; c.high += o.hi;
      if (o.hi - o.lo > 0.5) c.estimatedOrders++; else c.exactOrders++;
    } else { c.confirmed += o.total; c.low += o.total; c.high += o.total; c.exactOrders++; }
  }
  return c;
}

/** Category amounts must add up to the combined item cost of the orders. Returns both sides so the UI can show the check. Orders without any items (item fetch failed) are not part of either side. */
export function reconcile(orders: Order[], prices: Prices = {}) {
  const items = withAmounts(orders, prices);
  const withItems = orders.filter((o) => o.items.length);
  const byItems = items.reduce((s, o) => s + o.items.reduce((a, i) => a + (i.amount ?? 0), 0), 0);
  // item cost: the platform's own item prices where it gives them (they can differ slightly from its reported item total), the order total where it doesn't
  const itemCost = withItems.reduce((s, o) => s + (o.itemsPriced === false || !o.items.length ? o.total : o.items.reduce((a, i) => a + i.qty * i.unitPrice, 0)), 0);
  const paid = orders.reduce((s, o) => s + (o.fullTotal ?? o.total), 0);
  return { categories: byItems, itemCost, paid, ok: Math.abs(byItems - itemCost) < 1 };
}

/** Validates an untrusted (name, price) pair. Returns null when it is not a sensible item price. */
export function parsePrice(name: unknown, price: unknown): { name: string; price: number | null } | null {
  if (typeof name !== "string" || !name.trim() || name.length > 200) return null;
  if (price === null) return { name: name.trim(), price: null };
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0 || p > 1e6) return null;
  return { name: name.trim(), price: Math.round(p * 100) / 100 };
}
