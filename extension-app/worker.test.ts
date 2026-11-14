import vm from "node:vm";
import { beforeAll, describe, expect, it } from "vitest";

// End-to-end through the real service-worker code: fake Chrome (storage + scripting) and a fake Zomato site.
const mem: Record<string, unknown> = {};
let site: (url: string, init?: { method?: string; body?: string }) => unknown = () => ({ ok: false, status: 404, json: async () => ({}) });
const noop = { addListener() {} };
const chromeStub = {
  storage: { local: {
    get: async (k: string) => (k in mem ? { [k]: structuredClone(mem[k]) } : {}),
    set: async (o: Record<string, unknown>) => { for (const [k, v] of Object.entries(o)) mem[k] = structuredClone(v); },
    remove: async (ks: string | string[]) => { for (const k of [ks].flat()) delete mem[k]; },
  }, onChanged: noop },
  runtime: { onMessage: noop, onConnect: noop, onStartup: noop, onInstalled: noop, sendMessage() {}, getPlatformInfo() {}, id: "x" },
  action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
  tabs: { query: async () => [{ id: 1 }], get: async () => ({ id: 1 }), create: async () => ({ id: 2 }), remove: async () => {}, onUpdated: noop },
  // run the page-side function in a bare context that only has page globals, like a real tab
  scripting: { executeScript: async ({ func, args }: { func: (...a: unknown[]) => unknown; args?: unknown[] }) => {
    const ctx = vm.createContext({
      fetch: async (u: string, i?: unknown) => site(u, i as never), document: { cookie: "" }, crypto: { randomUUID: () => "u" }, localStorage: { getItem: () => null },
      chrome: { runtime: { sendMessage() {} } }, setTimeout, AbortSignal, URL, Date, JSON, Promise, Math, Array, Object, Set, Map, String, Number, RegExp, encodeURIComponent, decodeURIComponent, parseInt, parseFloat, Boolean,
    });
    (ctx as Record<string, unknown>).__a = args ?? [];
    return [{ result: await vm.runInContext(`(${func.toString()})(...__a)`, ctx) }];
  } },
};
(globalThis as unknown as { chrome: unknown }).chrome = chromeStub;

const res = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const order = (id: number, hash: string, dish: string, cost: string, date = "November 12, 2026 at 09:55 AM") =>
  ({ orderId: id, hashId: hash, totalCost: cost, orderDate: date, dishString: dish, deliveryDetails: { deliveryLabel: "Delivered" }, resInfo: { name: "Cafe" } });
const detail = (dish: string, price: number, grand: number) => ({ details: { order: { items: {
  dish: [{ itemName: dish, quantity: 1, totalCost: price }], item_total: [{ totalCost: price }], voucher_discount: [{ totalCost: -100 }], total_user: [{ totalCost: grand }] } } } });

describe("fetchPlatform(zomato)", () => {
  let fetchPlatform: (p: string, send: (m: unknown) => void) => Promise<void>;
  let store: typeof import("./store");
  beforeAll(async () => { ({ fetchPlatform } = (await import("./background.js")) as never); store = await import("./store"); });

  const detailCalls: string[] = [];
  const failing = new Set<string>();
  const orders = [order(1, "h1", "1 x Samosa", "₹166.59"), order(2, "h2", "1 x Tea", "₹60.00", "November 10, 2026 at 06:00 PM")];
  const details: Record<string, unknown> = { h1: detail("Samosa", 210, 166.59), h2: detail("Tea", 60, 60) };
  const events: { type: string; [k: string]: unknown }[] = [];
  const go = () => fetchPlatform("zomato", (m) => events.push(m as never));
  site = (url) => {
    if (url.startsWith("/webroutes/user/orders")) return res({ sections: { SECTION_USER_ORDER_HISTORY: { totalPages: 1 } }, entities: { ORDER: Object.fromEntries(orders.map((o) => [o.orderId, o])) } });
    if (url.startsWith("/webroutes/order/details")) { const h = new URL(url, "https://x").searchParams.get("hashId")!; detailCalls.push(h); return failing.has(h) ? res({}, 500) : res(details[h]); }
    return res({}, 404);
  };

  it("imports the list, then exact prices for every order, and stores them", async () => {
    await go();
    expect(detailCalls.sort()).toEqual(["h1", "h2"]);
    const got = await store.listOrders();
    const a = got.find((o) => o.id === "1")!;
    expect(a).toMatchObject({ itemsPriced: true, itemTotal: 210, discount: 100, total: 166.59 });
    expect(a.items[0]).toMatchObject({ name: "Samosa", unitPrice: 210 });
    const imp = events.find((e) => e.type === "imported")!;
    expect(imp).toMatchObject({ added: 2, priced: 2, failed: 0 });
    expect(events.some((e) => e.type === "progress" && e.what === "prices")).toBe(true);
  });
  it("a second fetch asks for details only about new orders", async () => {
    detailCalls.length = 0;
    orders.push(order(3, "h3", "1 x Dosa", "₹120.00", "November 13, 2026 at 01:00 PM"));
    details.h3 = detail("Dosa", 120, 120);
    await go();
    expect(detailCalls).toEqual(["h3"]);
    expect((await store.listOrders()).filter((o) => o.itemsPriced)).toHaveLength(3);
  });
  it("a failed detail call leaves the order estimated and never downgrades a priced one", async () => {
    detailCalls.length = 0; events.length = 0;
    orders.push(order(4, "h4", "1 x Tea, 1 x Samosa", "₹200.00", "November 14, 2026 at 01:00 PM"));
    failing.add("h4");
    await go();
    const got = await store.listOrders();
    expect(got.find((o) => o.id === "4")).toMatchObject({ itemsPriced: false });
    expect(got.find((o) => o.id === "1")!.itemsPriced).toBe(true); // the list-only copy did not replace it
    expect(events.find((e) => e.type === "imported")).toMatchObject({ failed: 1 });
  }, 40_000);
});
