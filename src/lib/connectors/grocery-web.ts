import { categorize, normalizeName } from "../enrich/categorize";
import type { Order, OrderItem, Platform } from "../types";

const IST_MS = (5 * 60 + 30) * 60_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

const lines = (items: { name: string; qty: number }[]): OrderItem[] =>
  items.filter((i) => i.name).map((i) => ({ name: normalizeName(i.name), rawName: i.name, qty: Math.max(1, i.qty || 1), unitPrice: 0, category: categorize(i.name, "grocery") }));

const base = (platform: Platform, id: string, placedAt: string, vendor: string, total: number, items: OrderItem[]): Order => ({
  id, platform, type: "grocery", placedAt, vendor, itemTotal: total, fees: 0, discount: 0, tip: 0, total, items, itemsPriced: false,
});

/* ---------------- Zepto ---------------- */
export interface ZeptoRaw {
  id: string;
  status: string;
  placedTime: string; // ISO UTC
  grandTotalAmount: number; // paise
  totalRefundAmount?: number; // paise
  items: { name: string; count: number }[];
}
export function mapZepto(raws: ZeptoRaw[]) {
  const orders: Order[] = [];
  let skipped = 0;
  for (const r of raws) {
    const t = Date.parse(r.placedTime);
    const total = r2(((Number(r.grandTotalAmount) || 0) - (Number(r.totalRefundAmount) || 0)) / 100);
    if (!/^DELIVERED$/i.test(r.status ?? "") || !Number.isFinite(t) || !r.id || total <= 0) { skipped++; continue; }
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
}
export function mapInstamart(raws: InstamartRaw[]) {
  const orders: Order[] = [];
  let skipped = 0;
  for (const r of raws) {
    const total = r2((Number(r.units) || 0) + (Number(r.nanos) || 0) / 1e9);
    const t = Number(r.created_at);
    if (!/^DELIVERED$/i.test(r.status ?? "") || !Number.isFinite(t) || !r.order_id || total <= 0) { skipped++; continue; }
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
  items: { name: string; qty: number }[];
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
    orders.push(base("blinkit", String(r.orderId), new Date(t).toISOString(), "Blinkit", total, lines(r.items ?? [])));
  }
  return { orders, skipped };
}
