import { PLATFORM_LABEL, type Order, type OrderType, type Platform } from "../types";

export interface Filters {
  from?: string; // yyyy-mm-dd
  to?: string;
  platforms: Platform[];
  type?: OrderType;
  categories: string[];
  minTotal?: number;
  maxTotal?: number;
  q?: string;
}

export const emptyFilters: Filters = { platforms: [], categories: [] };

/**
 * Keep only the selected categories' items and give the order the matching share of its money, so every chart that sums
 * order totals agrees with the filter. Priced orders use item prices for the share; unpriced ones (no item prices from the
 * platform) share by units, which is an estimate. An order made only of selected items is returned untouched.
 */
function narrowToCategories(o: Order, cats: string[]): Order {
  const kept = o.items.filter((i) => cats.includes(i.category));
  if (kept.length === o.items.length) return o;
  const units = (xs: Order["items"]) => xs.reduce((a, i) => a + i.qty, 0);
  const keptUnits = units(kept), allUnits = units(o.items);
  const byUnits = allUnits ? keptUnits / allUnits : 0;
  let share = byUnits;
  if (o.itemsPriced !== false) {
    const all = o.items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
    share = all > 0 ? kept.reduce((a, i) => a + i.qty * i.unitPrice, 0) / all : byUnits;
  }
  return {
    ...o, items: kept, allUnits: keptUnits, partial: true, fullTotal: o.total,
    itemTotal: o.itemTotal * share, fees: o.fees * share, discount: o.discount * share, tip: o.tip * share, total: o.total * share,
  };
}

export function applyFilters(orders: Order[], f: Filters): Order[] {
  const q = f.q?.trim().toLowerCase();
  const to = f.to ? new Date(f.to + "T23:59:59.999").getTime() : Infinity;
  const from = f.from ? new Date(f.from + "T00:00:00").getTime() : -Infinity;
  return orders
    .map((o) => (f.categories.length ? narrowToCategories(o, f.categories) : o))
    .filter((o) => {
      const t = new Date(o.placedAt).getTime();
      if (t < from || t > to) return false;
      if (f.platforms.length && !f.platforms.includes(o.platform)) return false;
      if (f.type && o.type !== f.type) return false;
      if (f.categories.length && o.items.length === 0) return false;
      const paid = o.fullTotal ?? o.total; // the order-size filter means what was really paid
      if (f.minTotal != null && paid < f.minTotal) return false;
      if (f.maxTotal != null && paid > f.maxTotal) return false;
      if (q && !(o.vendor.toLowerCase().includes(q) || o.items.some((i) => i.name.toLowerCase().includes(q)))) return false;
      return true;
    });
}

const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtMonth = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });

/** The active filters in words (not counting dates), e.g. ["Dairy & Eggs", "Zomato", "Grocery"]. */
export function filterParts(f: Filters): string[] {
  const parts: string[] = [];
  if (f.categories.length) parts.push(f.categories.length > 2 ? `${f.categories.length} categories` : f.categories.join(" + "));
  if (f.platforms.length) parts.push(f.platforms.map((p) => PLATFORM_LABEL[p]).join(" + "));
  if (f.type) parts.push(f.type === "food" ? "Food" : "Grocery");
  if (f.q?.trim()) parts.push(`“${f.q.trim()}”`);
  if (f.minTotal != null || f.maxTotal != null) parts.push(`orders ₹${f.minTotal ?? 0}–${f.maxTotal ?? "∞"}`);
  return parts;
}

/** The period a set of totals covers: the chosen date range, or first–last order month when no dates are chosen. */
export function periodLabel(f: Filters, orders: Order[], now = new Date()): string {
  if (!orders.length) return "No orders in this selection";
  if (f.from || f.to) {
    const today = now.toISOString().slice(0, 10);
    const days = f.from && f.to === today ? Math.round((Date.parse(today) - Date.parse(f.from)) / 864e5) : null;
    const preset = days === 30 ? "Last 30 days" : days === 90 ? "Last 90 days" : days === 365 ? "Last year" : null;
    if (preset) return preset;
    const ts = orders.map((o) => new Date(o.placedAt).getTime());
    const a = f.from ? new Date(f.from + "T00:00:00") : new Date(Math.min(...ts));
    const b = f.to ? new Date(f.to + "T00:00:00") : new Date(Math.max(...ts));
    return `${fmtDay(a)} – ${fmtDay(b)}`;
  }
  const ts = orders.map((o) => new Date(o.placedAt).getTime());
  return `All time (${fmtMonth(new Date(Math.min(...ts)))} – ${fmtMonth(new Date(Math.max(...ts)))})`;
}

/** What was actually paid across these orders (whole-order amounts even under a category filter). */
export const paidTotal = (orders: Order[]) => orders.reduce((s, o) => s + (o.fullTotal ?? o.total), 0);

/**
 * Money attributed to one item line. Orders with item prices use them (exact). Otherwise the order total is shared
 * across its item units (an estimate: exact only for single-item orders, and it includes that order's fees).
 */
export function lineSpend(o: Order, i: { qty: number; unitPrice: number }): { amount: number; estimated: boolean } {
  if (o.itemsPriced !== false) return { amount: i.qty * i.unitPrice, estimated: false };
  const units = o.allUnits ?? o.items.reduce((a, x) => a + x.qty, 0);
  return { amount: units ? (o.total * i.qty) / units : 0, estimated: true };
}

export interface Ranked { name: string; count: number; spend: number; estimated: number; orders: number } // estimated = part of spend that is an estimate

/** Rank items by quantity ordered and by money spent. */
export function topItems(orders: Order[], type?: OrderType): Ranked[] {
  const m = new Map<string, Ranked>();
  for (const o of orders) {
    if (type && o.type !== type) continue;
    const seen = new Set<string>();
    for (const i of o.items) {
      const r = m.get(i.name) ?? { name: i.name, count: 0, spend: 0, estimated: 0, orders: 0 };
      const l = lineSpend(o, i);
      r.count += i.qty;
      r.spend += l.amount;
      if (l.estimated) r.estimated += l.amount;
      if (!seen.has(i.name)) { r.orders++; seen.add(i.name); }
      m.set(i.name, r);
    }
  }
  return [...m.values()];
}

export interface ItemDetail {
  name: string;
  units: number; orders: number; spend: number; estimated: number;
  first: string; last: string;
  avgGapDays: number | null; // average days between orders containing it
  perMonth: number; // units per month between first and last order
  byHour: number[]; byWeekday: number[]; // units
  byMonth: { period: string; units: number; spend: number }[];
  platforms: { key: string; units: number; spend: number }[];
  vendors: { key: string; units: number }[];
  recent: { id: string; platform: string; placedAt: string; vendor: string; qty: number; amount: number; estimated: boolean }[];
}

/** Everything about one item across the given orders (drill-down). */
export function itemDetail(orders: Order[], name: string): ItemDetail | null {
  const hits = orders.filter((o) => o.items.some((i) => i.name === name)).sort((a, b) => a.placedAt.localeCompare(b.placedAt));
  if (!hits.length) return null;
  const d: ItemDetail = { name, units: 0, orders: hits.length, spend: 0, estimated: 0, first: hits[0].placedAt, last: hits[hits.length - 1].placedAt,
    avgGapDays: null, perMonth: 0, byHour: Array(24).fill(0), byWeekday: Array(7).fill(0), byMonth: [], platforms: [], vendors: [], recent: [] };
  const mon = new Map<string, { period: string; units: number; spend: number }>();
  const plat = new Map<string, { key: string; units: number; spend: number }>();
  const ven = new Map<string, { key: string; units: number }>();
  for (const o of hits) {
    const dt = new Date(o.placedAt);
    let qty = 0, amount = 0, est = false;
    for (const i of o.items) if (i.name === name) { const l = lineSpend(o, i); qty += i.qty; amount += l.amount; est ||= l.estimated; if (l.estimated) d.estimated += l.amount; }
    d.units += qty; d.spend += amount;
    d.byHour[dt.getHours()] += qty; d.byWeekday[(dt.getDay() + 6) % 7] += qty;
    const mk = o.placedAt.slice(0, 7);
    const mr = mon.get(mk) ?? { period: mk, units: 0, spend: 0 }; mr.units += qty; mr.spend += amount; mon.set(mk, mr);
    const pr = plat.get(o.platform) ?? { key: o.platform, units: 0, spend: 0 }; pr.units += qty; pr.spend += amount; plat.set(o.platform, pr);
    if (o.type === "food") { const vr = ven.get(o.vendor) ?? { key: o.vendor, units: 0 }; vr.units += qty; ven.set(o.vendor, vr); }
    d.recent.push({ id: o.id, platform: o.platform, placedAt: o.placedAt, vendor: o.vendor, qty, amount, estimated: est });
  }
  const span = (new Date(d.last).getTime() - new Date(d.first).getTime()) / 864e5;
  if (hits.length > 1) d.avgGapDays = span / (hits.length - 1);
  d.perMonth = d.units / Math.max(1, span / 30.44);
  d.byMonth = [...mon.values()].sort((a, b) => a.period.localeCompare(b.period));
  d.platforms = [...plat.values()].sort((a, b) => b.units - a.units);
  d.vendors = [...ven.values()].sort((a, b) => b.units - a.units).slice(0, 5);
  d.recent.reverse();
  return d;
}

export const byCount = (a: Ranked, b: Ranked) => b.count - a.count || b.spend - a.spend;
export const bySpend = (a: Ranked, b: Ranked) => b.spend - a.spend;

export function groupSum<K extends string>(orders: Order[], key: (o: Order) => K, val: (o: Order) => number = (o) => o.total) {
  const m = new Map<K, { key: K; value: number; orders: number }>();
  for (const o of orders) {
    const k = key(o);
    const r = m.get(k) ?? { key: k, value: 0, orders: 0 };
    r.value += val(o);
    r.orders += 1;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.value - a.value);
}

export function categorySpend(orders: Order[]) {
  const m = new Map<string, number>();
  for (const o of orders) for (const i of o.items) m.set(i.category, (m.get(i.category) ?? 0) + lineSpend(o, i).amount);
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function spendOverTime(orders: Order[], grain: "month" | "week" | "day" = "month") {
  const m = new Map<string, { period: string; food: number; grocery: number }>();
  for (const o of orders) {
    const d = new Date(o.placedAt);
    let key: string;
    if (grain === "month") key = o.placedAt.slice(0, 7);
    else if (grain === "day") key = o.placedAt.slice(0, 10);
    else {
      const w = new Date(d);
      w.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = w.toISOString().slice(0, 10);
    }
    const r = m.get(key) ?? { period: key, food: 0, grocery: 0 };
    r[o.type] += o.total;
    m.set(key, r);
  }
  return [...m.values()].sort((a, b) => a.period.localeCompare(b.period));
}

/** 7 (Mon..Sun) x 24 grid of order counts. */
export function heatmap(orders: Order[]) {
  const g = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const o of orders) {
    const d = new Date(o.placedAt);
    g[(d.getDay() + 6) % 7][d.getHours()]++;
  }
  return g;
}

export function kpis(orders: Order[]) {
  const n = orders.length;
  const sum = (f: (o: Order) => number) => orders.reduce((s, o) => s + f(o), 0);
  const total = sum((o) => o.total);
  const times = orders.map((o) => new Date(o.placedAt).getTime());
  const months = times.length ? Math.max(1, (Math.max(...times) - Math.min(...times)) / (30.44 * 864e5)) : 1;
  return {
    orders: n, total, avgOrder: n ? total / n : 0,
    fees: sum((o) => o.fees), discount: sum((o) => o.discount), tip: sum((o) => o.tip),
    perMonth: total / months,
    items: orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0),
  };
}

export function insights(orders: Order[]): string[] {
  const out: string[] = [];
  const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  const dish = topItems(orders, "food").sort(byCount)[0];
  const groc = topItems(orders, "grocery").sort(byCount)[0];
  const spendItem = topItems(orders).sort(bySpend)[0];
  if (dish && dish.orders >= 2) out.push(`Your most-ordered dish is ${dish.name}: ${dish.count} times${dish.spend > 0 ? `, about ${inr(dish.spend)} in total` : ""}.`);
  if (groc) out.push(`Your most-bought grocery item is ${groc.name}: ${groc.count} units.`);
  if (spendItem) out.push(`${spendItem.name} is where you spent the most money: ${inr(spendItem.spend)}.`);
  const k = kpis(orders);
  if (k.orders && k.fees > 0) out.push(`Delivery, handling and platform fees added up to ${inr(k.fees)} (${((k.fees / k.total) * 100).toFixed(1)}% of what you paid).`);
  const p = groupSum(orders, (o) => o.platform)[0];
  if (p) out.push(`${p.key[0].toUpperCase() + p.key.slice(1)} takes the biggest share of your wallet: ${inr(p.value)} across ${p.orders} orders.`);
  const h = heatmap(orders);
  let best = [0, 0, -1];
  h.forEach((row, d) => row.forEach((c, hr) => c > best[2] && (best = [d, hr, c])));
  if (best[2] > 0) out.push(`You order most often on ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][best[0]]} around ${best[1]}:00.`);
  return out;
}
