import { categorize, normalizeName } from "../enrich/categorize";
import type { Order, OrderItem } from "../types";

/** The only Zomato fields the extension forwards (no address, phone or payment details). */
export interface ZomatoRaw {
  orderId: string | number;
  orderDate: string; // "November 12, 2026 at 09:55 AM" (IST)
  totalCost: string; // "₹1,166.59"
  label: string; // deliveryDetails.deliveryLabel, "Delivered" for completed orders
  dishString: string; // "1 x 4 Pcs Samosa + 250 Grams Dhokla, 2 x Tea"
  vendor: string;
  locality?: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "November 12, 2026 at 09:55 AM" (IST) -> ISO UTC; null when the format is not recognised. */
export function parseZomatoDate(s: string): string | null {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(s.trim());
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1].toLowerCase());
  if (mon < 0) return null;
  let h = Number(m[4]) % 12;
  if (m[6].toUpperCase() === "PM") h += 12;
  const ms = Date.UTC(Number(m[3]), mon, Number(m[2]), h, Number(m[5])) - (5 * 60 + 30) * 60_000;
  return new Date(ms).toISOString();
}

export function parseRupees(s: string | number): number {
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** "1 x 4 Pcs Samosa + 250 Grams Dhokla, 2 x Tea" -> lines. Splits only where a new "<qty> x " starts, so names containing "x" stay whole. */
export function parseDishString(s: string): { qty: number; name: string }[] {
  return s
    .split(/,\s*(?=\d+\s*x\s)/i)
    .map((part) => /^(\d+)\s*x\s+(.+)$/i.exec(part.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ qty: Number(m[1]), name: m[2].trim() }));
}

export function mapZomato(raws: ZomatoRaw[]): { orders: Order[]; skipped: number } {
  const orders: Order[] = [];
  let skipped = 0;
  for (const r of raws) {
    const placedAt = parseZomatoDate(r.orderDate ?? "");
    const total = parseRupees(r.totalCost ?? "");
    if (r.label !== "Delivered" || !placedAt || !Number.isFinite(total) || !r.orderId) { skipped++; continue; }
    const items: OrderItem[] = parseDishString(r.dishString ?? "").map((l) => ({
      name: normalizeName(l.name), rawName: l.name, qty: l.qty, unitPrice: 0, category: categorize(l.name, "food"),
    }));
    orders.push({
      id: String(r.orderId), platform: "zomato", type: "food", placedAt, vendor: r.vendor || "Zomato",
      itemTotal: total, fees: 0, discount: 0, tip: 0, total, items, itemsPriced: false,
    });
  }
  return { orders, skipped };
}
