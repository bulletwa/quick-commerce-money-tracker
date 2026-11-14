import { describe, expect, it } from "vitest";
import { mapZomato, parseDishString, parseZomatoDate } from "./zomato-web";
import { mapSwiggy } from "./swiggy-web";

const z = (o: object) => ({ orderId: "1", orderDate: "November 12, 2026 at 09:55 AM", totalCost: "₹166.59", label: "Delivered", dishString: "1 x Tea", vendor: "Cafe", ...o });

describe("zomato", () => {
  it("parses dates with year, IST to UTC", () => {
    expect(parseZomatoDate("November 12, 2026 at 09:55 AM")).toBe("2026-11-12T04:25:00.000Z");
    expect(parseZomatoDate("February 16, 2023 at 12:05 AM")).toBe("2023-02-15T18:35:00.000Z");
    expect(parseZomatoDate("nonsense")).toBeNull();
  });
  it("keeps names containing x", () => {
    expect(parseDishString("1 x 4 Pcs Samosa + 250 Grams Dhokla, 2 x Paneer Tikka Maxx")).toEqual([
      { qty: 1, name: "4 Pcs Samosa + 250 Grams Dhokla" }, { qty: 2, name: "Paneer Tikka Maxx" },
    ]);
  });
  it("skips non-delivered, handles commas in totals", () => {
    const { orders, skipped } = mapZomato([z({ orderId: "a", totalCost: "₹1,166.50" }), z({ orderId: "b", label: "Refund Completed" }), z({ orderId: "c", label: "Payment Incomplete" })]);
    expect(skipped).toBe(2);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ id: "a", total: 1166.5, platform: "zomato", itemsPriced: false });
  });
});

describe("swiggy", () => {
  it("maps priced items, discount and fees", () => {
    const { orders, skipped } = mapSwiggy([
      { order_id: 1, order_time: "2026-10-12 05:26:02", order_total: "266", item_total: "273", order_discount: "52.3", order_status: "Delivered", restaurant_name: "R",
        items: [{ name: "Biryani", quantity: "2", total: "200" }, { name: "Coke", quantity: "1", total: "73" }] },
      { order_id: 2, order_time: "2026-10-12 05:26:02", order_total: "10", item_total: "10", order_status: "Cancelled", restaurant_name: "R", items: [] },
    ]);
    expect(skipped).toBe(1);
    expect(orders[0]).toMatchObject({ id: "1", total: 266, itemTotal: 273, discount: 52.3, fees: 45.3, placedAt: "2026-10-11T23:56:02.000Z", itemsPriced: true });
    expect(orders[0].items[0]).toMatchObject({ qty: 2, unitPrice: 100 });
  });
});

import { mapBlinkit, mapInstamart, mapZepto } from "./grocery-web";
describe("grocery", () => {
  it("zepto: paise, refunds, delivered only", () => {
    const { orders, skipped } = mapZepto([
      { id: "1", status: "DELIVERED", placedTime: "2026-10-02T05:19:50.244269952Z", grandTotalAmount: 93700, totalRefundAmount: 1000, items: [{ name: "Milk", count: 2 }] },
      { id: "2", status: "CANCELLED", placedTime: "2026-10-02T05:19:50Z", grandTotalAmount: 100, items: [] },
    ]);
    expect(skipped).toBe(1);
    expect(orders[0]).toMatchObject({ platform: "zepto", total: 927, type: "grocery" });
  });
  it("instamart: money units and status", () => {
    const { orders } = mapInstamart([{ order_id: 5, created_at: 1782226256000, status: "DELIVERED", units: 1820, nanos: 500000000, items: [{ name: "Eggs", quantity: 1 }] }]);
    expect(orders[0]).toMatchObject({ id: "5", total: 1820.5 });
  });
  it("blinkit: infers years walking newest to oldest", () => {
    const mk = (id: string, d: string) => ({ orderId: id, status: "DELIVERED", amount: "₹100", dateText: d, items: [] });
    const { orders } = mapBlinkit([mk("a", "11 Nov, 10:30 pm"), mk("b", "3 Mar, 9:00 am"), mk("c", "20 Dec, 8:00 pm"), mk("d", "5 Jan 2024, 7:00 pm"), mk("e", "30 Dec 2023")], new Date("2026-11-14T00:00:00Z"));
    expect(orders.map((o) => o.placedAt.slice(0, 7))).toEqual(["2026-11", "2026-03", "2025-12", "2024-01", "2023-12"]);
  });
});
