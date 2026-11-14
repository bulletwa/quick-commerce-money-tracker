import { categorize } from "./enrich/categorize";
import type { Order, OrderItem, OrderType, Platform } from "./types";

// Deterministic PRNG so sample data is stable.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

const FOOD: [string, number, string][] = [
  ["Chicken Biryani", 280, "Behrouz Biryani"], ["Paneer Butter Masala", 240, "Punjabi Tadka"],
  ["Margherita Pizza", 310, "Domino's"], ["Veg Burger", 150, "Burger King"],
  ["Masala Dosa", 130, "Udupi Cafe"], ["Hakka Noodles", 190, "Wok Express"],
  ["Butter Naan", 55, "Punjabi Tadka"], ["Chocolate Brownie", 120, "Brownie Point"],
  ["Cold Coffee", 140, "Third Wave Coffee"], ["Chicken Roll", 120, "Rolls King"],
  ["Veg Momos", 110, "Wow! Momo"], ["Dal Khichdi", 170, "Home Meals"],
];
const GROC: [string, number, string][] = [
  ["Amul Taaza Milk 500 ml", 29, "Store"], ["Onion 1 kg", 45, "Store"], ["Tomato 500 g", 30, "Store"],
  ["Banana 6 pcs", 50, "Store"], ["Eggs 12 pcs", 96, "Store"], ["Maggi Noodles 4 pack", 56, "Store"],
  ["Lays Classic 52 g", 20, "Store"], ["Aashirvaad Atta 5 kg", 290, "Store"], ["Coca-Cola 750 ml", 40, "Store"],
  ["Dairy Milk Silk", 90, "Store"], ["Bread Sandwich Loaf", 45, "Store"], ["Curd 400 g", 38, "Store"],
  ["Paneer 200 g", 95, "Store"], ["Surf Excel Detergent 1 kg", 210, "Store"], ["Ice Cream Tub", 180, "Store"],
];

export function generateSample(now = new Date("2026-11-13T12:00:00Z")): Order[] {
  const r = rng(42);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const out: Order[] = [];
  const plat: [Platform, OrderType, number][] = [
    ["zomato", "food", 90], ["swiggy", "food", 110], ["swiggy", "grocery", 70], ["zomato", "grocery", 100],
  ];
  for (const [platform, type, count] of plat) {
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getTime() - r() * 365 * 864e5);
      const hour = type === "food" ? pick([13, 14, 20, 21, 22, 23]) : pick([8, 9, 18, 19, 21, 22]);
      d.setHours(hour, Math.floor(r() * 60));
      const pool = type === "food" ? FOOD : GROC;
      const n = type === "food" ? 1 + Math.floor(r() * 3) : 2 + Math.floor(r() * 6);
      const items: OrderItem[] = [];
      for (let k = 0; k < n; k++) {
        const [raw, price] = pick(pool);
        const name = raw.replace(/\b\d+(\.\d+)?\s?(g|kg|ml|pcs|pack)\b/gi, "").replace(/\s+/g, " ").trim();
        items.push({ rawName: raw, name, qty: 1 + Math.floor(r() * 2), unitPrice: price, category: categorize(raw, type) });
      }
      const itemTotal = items.reduce((s, x) => s + x.qty * x.unitPrice, 0);
      const fees = Math.round(type === "food" ? 30 + r() * 40 : 10 + r() * 30);
      const discount = r() < 0.4 ? Math.round(itemTotal * (0.05 + r() * 0.2)) : 0;
      const tip = type === "food" && r() < 0.25 ? 20 : 0;
      out.push({
        id: `${platform.toUpperCase()}-${type}-${100000 + i}`, platform, type,
        placedAt: d.toISOString(), vendor: type === "food" ? pick(FOOD)[2] : `${platform[0].toUpperCase()}${platform.slice(1)} Dark Store`,
        itemTotal, fees, discount, tip, total: itemTotal + fees - discount + tip, items,
      });
    }
  }
  return out.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}
