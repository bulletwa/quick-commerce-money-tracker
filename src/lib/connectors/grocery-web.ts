import { categorize, normalizeName } from "../enrich/categorize";
import type { Order, OrderItem, Platform } from "../types";

const IST_MS = (5 * 60 + 30) * 60_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

const lines = (items: { name: string; qty: number }[]): OrderItem[] =>
  items.filter((i) => i.name).map((i) => ({ name: normalizeName(i.name), rawName: i.name, qty: Math.max(1, i.qty || 1), unitPrice: 0, category: categorize(i.name, "grocery") }));

const base = (platform: Platform, id: string, placedAt: string, vendor: string, total: number, items: OrderItem[]): Order => ({
  id, platform, type: "grocery", placedAt, vendor, itemTotal: total, fees: 0, discount: 0, tip: 0, total, items, itemsPriced: false,
});

const pricedLines = (items: { name: string; qty: number; line: number }[]): OrderItem[] =>
  items.map((i) => {
    const qty = Math.max(1, Math.round(i.qty) || 1);
    return { name: normalizeName(i.name), rawName: i.name, qty, unitPrice: r2(i.line / qty), category: categorize(i.name, "grocery") };
  });

/* ---------------- Zepto ---------------- */
export interface ZeptoRaw {
  id: string;
  status: string;
  placedTime: string; // ISO UTC
  grandTotalAmount: number; // paise
  totalRefundAmount?: number; // paise
  items: { name: string; count: number }[];
  /** From the order-detail call: final line totals in paise (after coupons/coins), per product. */
  detail?: { name: string; qty: number; total: number }[];
}
/** Zepto's detail lines are priced after coupons, so they add up to what was paid minus fees: they must not exceed the total, nor be implausibly small. */
export function zeptoPriced(detail: ZeptoRaw["detail"], total: number) {
  if (!detail?.length || detail.some((d) => !d.name || !Number.isFinite(d.total) || d.total < 0)) return null;
  const lines = detail.map((d) => ({ name: d.name, qty: d.qty, line: r2(d.total / 100) }));
  const sum = r2(lines.reduce((a, l) => a + l.line, 0));
  if (sum > total + 1 || sum < total * 0.5) return null;
  return { items: pricedLines(lines), itemTotal: sum, fees: Math.max(0, r2(total - sum)) };
}
export function mapZepto(raws: ZeptoRaw[]) {
  const orders: Order[] = [];
  let skipped = 0;
  for (const r of raws) {
    const t = Date.parse(r.placedTime);
    const total = r2(((Number(r.grandTotalAmount) || 0) - (Number(r.totalRefundAmount) || 0)) / 100);
    if (!/^DELIVERED$/i.test(r.status ?? "") || !Number.isFinite(t) || !r.id || total <= 0) { skipped++; continue; }
    const priced = zeptoPriced(r.detail, total);
    if (priced) {
      orders.push({ ...base("zepto", String(r.id), new Date(t).toISOString(), "Zepto", total, priced.items), itemTotal: priced.itemTotal, fees: priced.fees, itemsPriced: true });
      continue;
    }
    orders.push(base("zepto", String(r.id), new Date(t).toISOString(), "Zepto", total, lines((r.items ?? []).map((i) => ({ name: i.name, qty: Number(i.count) })))));
  }
  return { orders, skipped };
}

/* ---------------- Instamart ---------------- */
export interface InstamartRaw {
  order_id: string | number;
  created_at: number; // epoch ms
  status: string; // history_status
  units: number | string;
  nanos?: number | string;
  items: { name: string; quantity: number | string }[];
  /** From order_data...metadata.bill.billedItems: each line's total (₹) and the platform's own item cost for the order. */
  lines?: { name: string; qty: number; total: number }[];
  itemCost?: number | null;
}
/** Exact lines when the item prices add up to the platform's own item cost (within ₹1), and cost no more than was paid. */
export function instamartPriced(r: Pick<InstamartRaw, "lines" | "itemCost">, total: number) {
  const lines = r.lines ?? [];
  if (!lines.length || r.itemCost == null || lines.some((l) => !l.name || !Number.isFinite(l.total) || l.total < 0)) return null;
  const sum = r2(lines.reduce((a, l) => a + l.total, 0));
  if (Math.abs(sum - r.itemCost) > 1 || sum > total + 1) return null;
  return { items: pricedLines(lines.map((l) => ({ name: l.name, qty: l.qty, line: l.total }))), itemTotal: sum, fees: Math.max(0, r2(total - sum)) };
}
export function mapInstamart(raws: InstamartRaw[]) {
  const orders: Order[] = [];
  let skipped = 0;
  for (const r of raws) {
    const total = r2((Number(r.units) || 0) + (Number(r.nanos) || 0) / 1e9);
    const t = Number(r.created_at);
    if (!/^DELIVERED$/i.test(r.status ?? "") || !Number.isFinite(t) || !r.order_id || total <= 0) { skipped++; continue; }
    const priced = instamartPriced(r, total);
    if (priced) {
      orders.push({ ...base("instamart", String(r.order_id), new Date(t).toISOString(), "Instamart", total, priced.items), itemTotal: priced.itemTotal, fees: priced.fees, itemsPriced: true });
      continue;
    }
    orders.push(base("instamart", String(r.order_id), new Date(t).toISOString(), "Instamart", total, lines((r.items ?? []).map((i) => ({ name: i.name, qty: Number(i.quantity) })))));
  }
  return { orders, skipped };
}

/* ---------------- Blinkit ---------------- */
export interface BlinkitRaw {
  orderId: string;
  status: string;
  amount: string; // "₹522"
  dateText: string; // "11 Nov, 10:30 pm" (IST, year missing) or "30 Dec 2025" (older orders: no time)
  items: { name: string; qty: number; line?: number }[]; // line = what the order page shows for the line (₹, after discounts)
  bill?: Record<string, number>; // the order page's bill rows by label, e.g. "Item total", "Delivery charges", "Bill total"
}

/**
 * Exact lines for a Blinkit order when its bill agrees with itself. Bill rows are signed ("-₹14" is a discount). Line prices are net of
 * "Product discount", so item prices add up to the "Item total" row; a coupon ("Promo discount") comes off afterwards. Without an
 * "Item total" row the check is: item prices + every other bill row (fees, tip, promo discount) = "Bill total".
 * A row such as "1 item unavailable" (no price, refunded) is not an item.
 */
export function blinkitPriced(r: Pick<BlinkitRaw, "items" | "bill">, total: number) {
  const items = (r.items ?? []).filter((i) => Number.isFinite(i.line) || !/unavailable/i.test(i.name ?? ""));
  if (!items.length || !items.every((i) => i.name && Number.isFinite(i.line) && (i.line as number) >= 0)) return null;
  const sum = r2(items.reduce((a, i) => a + (i.line as number), 0));
  const bill = r.bill ?? {};
  // every row that is neither the gross/net item figures nor the total: fees and tips (+), promo/coupon discounts (-)
  const other = Object.entries(bill).filter(([k]) => !/^(mrp|product discount|item total|bill total)$/i.test(k.trim()));
  const tip = r2(other.filter(([k]) => /tip/i.test(k)).reduce((a, [, v]) => a + v, 0));
  const discount = r2(other.filter(([k, v]) => v < 0 && !/tip/i.test(k)).reduce((a, [, v]) => a - v, 0));
  const otherSum = r2(other.reduce((a, [, v]) => a + v, 0));
  const itemTotal = bill["Item total"], billTotal = bill["Bill total"];
  const ok = itemTotal != null ? Math.abs(sum - itemTotal) <= 1 : billTotal != null ? Math.abs(sum + otherSum - billTotal) <= 1 : false;
  if (!ok) return null;
  return { items: pricedLines(items.map((i) => ({ name: i.name, qty: i.qty, line: i.line as number }))), itemTotal: sum, tip, discount, fees: Math.max(0, r2(total - sum - tip + discount)) };
}
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*,?\s*(?:(\d{4}),?\s*)?(?:(\d{1,2}):(\d{2})\s*([ap]m))?/i; // older orders show a date without a time

/** Blinkit shows no year for recent orders. The list is newest first, so walk it and step the year back whenever the date jumps forward. */
export function mapBlinkit(raws: BlinkitRaw[], now = new Date()) {
  const orders: Order[] = [];
  let skipped = 0;
  let year = now.getUTCFullYear() + 1; // forced down below
  let prev = now.getTime();
  const at = (y: number, m: number) => (d: number, h: number, min: number) => Date.UTC(y, m, d, h, min) - IST_MS;
  for (const r of raws) {
    const m = DATE.exec(r.dateText ?? "");
    const mon = m ? MON.indexOf(m[2].toLowerCase()) : -1;
    if (!m || mon < 0) { skipped++; continue; }
    let h = m[4] ? Number(m[4]) % 12 : 12; // no time shown: assume noon
    if (m[6]?.toLowerCase() === "pm") h += 12;
    const when = (y: number) => at(y, mon)(Number(m[1]), h, Number(m[5] ?? 0));
    let t: number;
    if (m[3]) { t = when(Number(m[3])); year = Number(m[3]); }
    else {
      t = when(year);
      while (t > prev + 36e5) t = when(--year); // must not be newer than the order before it
    }
    prev = t;
    const total = Number(String(r.amount).replace(/[^0-9.]/g, ""));
    if (!/^DELIVERED$/i.test(r.status ?? "") || !r.orderId || !Number.isFinite(total) || total <= 0) { skipped++; continue; }
    const priced = blinkitPriced(r, total);
    if (priced) {
      orders.push({ ...base("blinkit", String(r.orderId), new Date(t).toISOString(), "Blinkit", total, priced.items), itemTotal: priced.itemTotal, fees: priced.fees, tip: priced.tip, discount: priced.discount, itemsPriced: true });
      continue;
    }
    orders.push(base("blinkit", String(r.orderId), new Date(t).toISOString(), "Blinkit", total, lines(r.items ?? [])));
  }
  return { orders, skipped };
}
