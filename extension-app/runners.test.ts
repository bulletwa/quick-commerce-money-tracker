import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { blinkitPriced } from "../src/lib/connectors/grocery-web";
import { pricedFromDetail } from "../src/lib/connectors/zomato-web";

// The page-side runners are serialised into the site's tab, so they must work with nothing but page globals.
// Here each one is cut out of background.js and run in a bare vm context with a fake fetch shaped like the real responses.
const src = fs.readFileSync(path.join(__dirname, "background.js"), "utf8");
function runner(name: string): string {
  const i = src.indexOf(`async function ${name}(`);
  if (i < 0) throw new Error(`no ${name}`);
  let depth = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") depth++;
    else if (src[k] === "}" && --depth === 0) return src.slice(i, k + 1);
  }
  throw new Error("unbalanced");
}
const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const run = (name: string, fetchImpl: (url: string, init?: { body?: string }) => unknown, arg: unknown) => {
  const ctx = vm.createContext({
    fetch: async (u: string, i?: { body?: string }) => fetchImpl(u, i), document: { cookie: "XSRF-TOKEN=a" }, crypto: { randomUUID: () => "u" },
    localStorage: { getItem: (k: string) => (k === "auth" ? '{"accessToken":"t"}' : k === "authKey" ? "k" : null) },
    chrome: { runtime: { sendMessage() {} } }, setTimeout, AbortSignal, URL, Date, JSON, Promise, Math, Array, Object, Set, Map, String, Number, RegExp, encodeURIComponent, decodeURIComponent, parseInt, parseFloat, Boolean,
  });
  ctx.__arg = arg;
  return vm.runInContext(`(${runner(name)})(__arg)`, ctx) as Promise<{ details: { orderId: string; detail?: unknown; items?: unknown; bill?: Record<string, number>; error?: string }[] }>;
};

const snippet = (name: string, sub1: string, sub3: string) => ({ widget_type: "z_v3_image_text_snippet_type_30", data: { title: { text: name }, subtitle1: { text: sub1 }, subtitle3: { text: sub3 } } });
const bill = (l: string, r: string) => ({ widget_type: "cart_bill_item", data: { left_header: { text: l }, right_header: { text: r } } });

describe("runBlinkitDetails", () => {
  const snippets = [
    { widget_type: "v2_image_text_snippet_type_30", data: { title: { text: "2 items in this order" } } },
    snippet("Marlboro Advance Compact", "10 pcs x 2", "₹244"),
    snippet("Amul Taaza Toned Milk", "500 ml x 2", "~~<regular-200|{grey-600|₹60}>~~ ₹46"),
    snippet("Fortune Oil", "Pack of 6", "₹1,234.50"), // a trailing number that is not a quantity
    { widget_type: "z_v3_image_text_snippet_type_30", data: { title: { text: "1 item unavailable" } } }, // refunded row: no quantity, no price
    bill("MRP", "₹304"), bill("Product discount", "-₹14"), bill("Item total", "₹290"), bill("Delivery charges", "+₹12"), bill("Bill total", "₹320"),
  ];
  it("reads line prices (struck-through MRP ignored), quantities and signed bill rows", async () => {
    const r = await run("runBlinkitDetails", () => json(200, { response: { snippets } }), [{ orderId: "9", cartId: "8" }]);
    const d = r.details[0] as { items: { name: string; qty: number; line: number }[]; bill: Record<string, number> };
    expect(d.items.map((i) => [i.name, i.qty, i.line])).toEqual([["Marlboro Advance Compact", 2, 244], ["Amul Taaza Toned Milk", 2, 46], ["Fortune Oil", 1, 1234.5]]);
    expect(d.bill).toMatchObject({ MRP: 304, "Product discount": -14, "Item total": 290, "Delivery charges": 12, "Bill total": 320 });
  });
  it("its output feeds straight into the mapper's reconcile check", () => {
    const items = [{ name: "A", qty: 2, line: 244 }, { name: "B", qty: 2, line: 46 }];
    expect(blinkitPriced({ items, bill: { "Item total": 290, "Bill total": 320, "Delivery charges": 30 } }, 320)).toMatchObject({ itemTotal: 290, fees: 30 });
  });
});

describe("runZomatoDetails", () => {
  const details = { details: { order: { items: {
    dish: [{ itemName: "4 Pcs Samosa + 250 Grams Dhokla", quantity: 1, totalCost: 210 }],
    item_total: [{ totalCost: 210 }], subtotal2: [{ totalCost: 210 }],
    voucher_discount: [{ itemName: "Coupon - (YUMMY)", totalCost: -100 }],
    salt_discount: [{ itemName: "Restaurant Promo", totalCost: 35 }], // restaurant promos come with a positive amount
    tax: [{ totalCost: 8.9 }], charge: [{ totalCost: 44 }, { totalCost: 30 }], platform_charge: [{ totalCost: 14.99 }],
    total_user: [{ totalCost: 166.59 }], savings: [{ totalCost: 144 }],
  } }, userPhone: "never read" } };
  it("returns dishes, the platform's item total, discounts and grand total, nothing personal", async () => {
    const urls: string[] = [];
    const r = await run("runZomatoDetails", (u) => { urls.push(u); return json(200, details); }, [{ orderId: "1", hashId: "xEbOxdBq" }]);
    expect(urls[0]).toBe("/webroutes/order/details?hashId=xEbOxdBq");
    expect(r.details[0].detail).toEqual({ dishes: [{ name: "4 Pcs Samosa + 250 Grams Dhokla", qty: 1, total: 210 }], itemTotal: 210, discount: 135, grandTotal: 166.59 });
    expect(JSON.stringify(r)).not.toContain("never read");
    expect(pricedFromDetail(r.details[0].detail as never, 166.59)).not.toBeNull();
  });
  it("reports a logged-out session and retries failures", async () => {
    expect((await run("runZomatoDetails", () => json(401, {}), [{ orderId: "1", hashId: "h" }])).details[0].error).toBe("not-logged-in");
    let calls = 0;
    const r = await run("runZomatoDetails", () => (++calls < 2 ? json(500, {}) : json(200, details)), [{ orderId: "1", hashId: "h" }]);
    expect(r.details[0].detail).toBeTruthy();
    expect(calls).toBe(2);
  });
});

describe("runZeptoDetails", () => {
  const product = (name: string, q: number, total: number) => ({ quantityOrdered: q, quantityFulfilled: q, totalFinalSellingPrice: total, storeProduct: { product: { name } } });
  it("finds nested orderProducts and returns paise line totals", async () => {
    let body = "";
    const page = { pageLayout: { widgets: [{ data: { items: [{ orderProductsV2: { sectionData: [{ orderProducts: [product("Marlboro Advance Compact", 3, 36600), product("Milk", 2, 6000)] }] } }] } }] } };
    const r = await run("runZeptoDetails", (_u, init) => { body = init?.body ?? ""; return json(200, page); }, [{ orderId: "01a0954c" }]);
    expect(JSON.parse(body)).toMatchObject({ orderId: "01a0954c", isArchived: false });
    expect(r.details[0].detail).toEqual([{ name: "Marlboro Advance Compact", qty: 3, total: 36600 }, { name: "Milk", qty: 2, total: 6000 }]);
  });
});

describe("runInstamart", () => {
  const job = (items: { name: string; qty: number; total: number }[], cost: number) => ({
    metadata: JSON.stringify({ orderTotal: cost + 29, bill: { totalItemCost: cost, subTotal: cost, billedItems: items.map((i) => ({ item: { name: i.name, quantity: i.qty }, bill: { quantity: i.qty, totalCost: i.total, itemPrice: i.total / i.qty } })) } }),
  });
  const order = { order_id: "9", created_at: 1782226256000, history_status: "DELIVERED", order_data_v2: { total: { units: 1820, nanos: 0 }, shipments: [{ items: [{ name: "Marlboro Clove", quantity: 4 }] }] },
    order_data: { orders: [{ order_jobs: [job([{ name: "Marlboro Clove", qty: 4, total: 960 }], 960), job([{ name: "Milk", qty: 2, total: 60 }], 60)] }] } };
  it("reads each line's total and the item cost across all of an order's jobs, nothing else", async () => {
    const r = (await run("runInstamart", () => json(200, { statusCode: 0, data: { orders: [order] } }), undefined)) as unknown as { orders: { lines: unknown[]; itemCost: number; items: unknown[] }[] };
    expect(r.orders[0].lines).toEqual([{ name: "Marlboro Clove", qty: 4, total: 960 }, { name: "Milk", qty: 2, total: 60 }]);
    expect(r.orders[0].itemCost).toBe(1020);
    expect(JSON.stringify(r)).not.toContain("customer");
  });
});

describe("transient failures", () => {
  it("swiggy retries a 503 and then reads the orders", async () => {
    let calls = 0;
    const r = (await run("runSwiggy", () => (++calls < 3 ? json(503, {}) : json(200, { data: { orders: [] } })), undefined)) as unknown as { orders: unknown[] };
    expect(r.orders).toEqual([]);
    expect(calls).toBe(3);
  }, 20_000);
  it("zepto treats a lone 401 as a hiccup but a persistent one as logged out", async () => {
    let calls = 0;
    const ok = (await run("runZepto", () => (++calls < 2 ? json(401, { message: "x", code: "y" }) : json(200, { orders: [], endOfList: true })), undefined)) as unknown as { orders: unknown[] };
    expect(ok.orders).toEqual([]);
    const out = (await run("runZepto", () => json(401, { message: "x" }), undefined)) as unknown as { error: string };
    expect(out.error).toBe("not-logged-in");
  }, 30_000);
});

describe("checkLogin", () => {
  const check = async (platform: string, f: (url: string) => unknown, localAuth = true) => {
    const ctx = vm.createContext({
      fetch: async (u: string) => f(u), document: { cookie: "XSRF-TOKEN=a" }, crypto: { randomUUID: () => "u" }, Date, JSON, Promise, RegExp, String, Object, decodeURIComponent,
      localStorage: { getItem: (k: string) => (localAuth ? (k === "auth" ? '{"accessToken":"t"}' : k === "authKey" ? "k" : null) : null) },
    });
    ctx.__p = platform;
    return (await (vm.runInContext(`(${runner("checkLogin")})(__p)`, ctx) as Promise<{ state: string }>)).state;
  };
  it("says in/out per site from one cheap request", async () => {
    expect(await check("zomato", () => json(200, { sections: { SECTION_USER_ORDER_HISTORY: {} } }))).toBe("in");
    expect(await check("zomato", () => json(401, {}))).toBe("out");
    expect(await check("zomato", () => json(200, { sections: {} }))).toBe("out");
    expect(await check("swiggy", () => json(200, { data: { orders: [] } }))).toBe("in");
    expect(await check("swiggy", () => json(200, { statusMessage: "Please login" }))).toBe("out");
    expect(await check("instamart", () => json(200, { statusCode: 0 }))).toBe("in");
    expect(await check("instamart", () => json(200, { statusCode: 1 }))).toBe("out");
    expect(await check("zepto", () => json(200, {}))).toBe("in");
    expect(await check("zepto", () => json(403, {}))).toBe("out");
    expect(await check("blinkit", () => json(200, {}))).toBe("in");
    expect(await check("blinkit", () => json(200, {}), false)).toBe("out");
  });
  it("says unknown (not out) when the site is busy or unreachable", async () => {
    expect(await check("swiggy", () => json(503, {}))).toBe("unknown");
    expect(await check("zepto", () => { throw new Error("offline"); })).toBe("unknown");
  });
});
