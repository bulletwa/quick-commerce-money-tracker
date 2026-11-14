import { describe, expect, it } from "vitest";
import { buildStories } from "./stories";
import type { Order } from "./types";

let n = 0;
const order = (placedAt: string, items: { name: string; category: string; qty?: number }[], over: Partial<Order> = {}): Order => ({
  id: String(++n), platform: "zomato", type: "food", placedAt, vendor: "V", items: items.map((i) => ({ name: i.name, rawName: i.name, qty: i.qty ?? 1, unitPrice: 100, category: i.category })),
  itemTotal: 100, fees: 0, discount: 0, tip: 0, total: 100, status: "delivered", ...over,
} as Order);

describe("buildStories", () => {
  it("is empty without orders", () => expect(buildStories([])).toEqual([]));
  it("names the top dish and never mentions sensitive categories", () => {
    const os = [
      ...Array.from({ length: 6 }, () => order("2026-05-04T13:00:00", [{ name: "Marlboro", category: "Tobacco" }], { type: "grocery" })),
      order("2026-05-05T13:00:00", [{ name: "Tawa Roti", category: "Indian Mains" }]),
      order("2026-05-06T13:00:00", [{ name: "Tawa Roti", category: "Indian Mains" }]),
    ];
    const s = buildStories(os, new Date("2026-06-10"));
    expect(s.find((x) => x.id === "dish")?.headline).toBe("Tawa Roti");
    expect(s.find((x) => x.id === "grocery")).toBeUndefined();
    expect(JSON.stringify(s)).not.toMatch(/Marlboro|Tobacco/);
  });
  it("finds the usual weekday and hour once there are enough orders", () => {
    const os = Array.from({ length: 12 }, (_, i) => order(`2026-05-${String(2 + i * 7 > 28 ? 2 : 2 + i * 7).padStart(2, "0")}T21:10:00`, [{ name: "X", category: "Snacks" }]));
    const w = buildStories(os).find((x) => x.id === "when");
    expect(w?.headline).toMatch(/9pm/);
  });
});
