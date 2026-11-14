import { categorize, normalizeName } from "../enrich/categorize";
import type { Order, OrderItem } from "../types";

/** The only Swiggy fields the extension forwards. */
export interface SwiggyRaw {
  order_id: string | number;
  order_time: string; // "2026-10-12 05:26:02" (IST)
  order_total: string | number;
  item_total: string | number;
  order_discount?: string | number;
  order_status: string;
  order_type?: string;
  restaurant_name: string;
  items: { name: string; quantity: string | number; total: string | number }[];
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const r2 = (n: number) => Math.round(n * 100) / 100;

export function parseSwiggyDate(s: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) - (5 * 60 + 30) * 60_000;
  return new Date(ms).toISOString();
}

export function mapSwiggy(raws: SwiggyRaw[]): { orders: Order[]; skipped: number } {
  const orders: Order[] = [];
  let skipped = 0;
  for (const r of raws) {
    const placedAt = parseSwiggyDate(r.order_time ?? "");
    const total = num(r.order_total);
    if (!/^delivered$/i.test(r.order_status ?? "") || !placedAt || !Number.isFinite(total) || !r.order_id) { skipped++; continue; }
    const items: OrderItem[] = (r.items ?? []).map((i) => {
      const qty = Math.max(1, num(i.quantity) || 1);
      return { name: normalizeName(i.name), rawName: i.name, qty, unitPrice: r2((num(i.total) || 0) / qty), category: categorize(i.name, "food") };
    });
    const itemTotal = Number.isFinite(num(r.item_total)) ? num(r.item_total) : r2(items.reduce((a, i) => a + i.qty * i.unitPrice, 0));
    const discount = Math.max(0, num(r.order_discount) || 0);
    orders.push({
      id: String(r.order_id), platform: "swiggy", type: "food", placedAt, vendor: r.restaurant_name || "Swiggy",
      itemTotal, fees: Math.max(0, r2(total - itemTotal + discount)), discount, tip: 0, total, items,
      itemsPriced: items.length > 0,
    });
  }
  return { orders, skipped };
}
