import { beforeEach, describe, expect, it } from "vitest";
import type { Order } from "../src/lib/types";

const mem: Record<string, unknown> = {};
(globalThis as unknown as { chrome: unknown }).chrome = { storage: { local: {
  get: async (k: string) => (k in mem ? { [k]: structuredClone(mem[k]) } : {}),
  set: async (o: Record<string, unknown>) => { for (const [k, v] of Object.entries(o)) mem[k] = structuredClone(v); },
  remove: async (ks: string | string[]) => { for (const k of [ks].flat()) delete mem[k]; },
} } };
const store = await import("./store");

const order = (id: string, items: Order["items"] = [{ name: "Milk", rawName: "Amul Taaza Toned Milk", qty: 1, unitPrice: 0, category: "x" }]): Order => ({
  id, platform: "blinkit", type: "grocery", placedAt: "2026-10-01T10:00:00.000Z", vendor: "Blinkit", itemTotal: 100, fees: 0, discount: 0, tip: 0, total: 100, items, itemsPriced: false,
});

describe("extension store", () => {
  beforeEach(async () => { await store.clearAll(); });
  it("upserts by platform+id and never wipes saved items with an empty refetch", async () => {
    expect(await store.upsertOrders([order("1"), order("2")])).toEqual({ added: 2, updated: 0 });
    expect(await store.upsertOrders([order("1", [])])).toEqual({ added: 0, updated: 1 });
    const o = (await store.listOrders()).find((x) => x.id === "1")!;
    expect(o.items).toHaveLength(1);
    expect(o.items[0].category).toBe("Dairy & Eggs"); // re-categorised on read
  });
  it("handles parallel writes without losing any", async () => {
    await Promise.all([1, 2, 3, 4, 5].map((n) => store.upsertOrders([order(String(n))])));
    expect(await store.listOrders()).toHaveLength(5);
  });
  it("round-trips a backup and rejects junk", async () => {
    await store.upsertOrders([order("1")]);
    await store.saveGoals({ label: "Cap", scope: "food", metric: "orders", limit: 8 });
    const json = await store.exportJson();
    await store.clearAll();
    expect(await store.importJson(json)).toEqual({ orders: 1, goals: 1 });
    await expect(store.importJson("nope")).rejects.toThrow();
    await expect(store.importJson(JSON.stringify({ orders: [{ id: 1 }] }))).rejects.toThrow();
    await expect(store.saveGoals({ label: "", scope: "x", metric: "orders", limit: 1 })).rejects.toThrow();
  });
  it("deletes goals", async () => {
    const [g] = await store.saveGoals({ label: "Cap", scope: "food", metric: "orders", limit: 8 });
    expect(await store.deleteGoal(g.id)).toEqual([]);
  });
});
