import { upsertOrders } from "@/lib/db";
import { mapSwiggy, type SwiggyRaw } from "@/lib/connectors/swiggy-web";
import { mapZomato, type ZomatoRaw } from "@/lib/connectors/zomato-web";
import { mapBlinkit, mapInstamart, mapZepto, type BlinkitRaw, type InstamartRaw, type ZeptoRaw } from "@/lib/connectors/grocery-web";
import { getToken, hostOk } from "@/lib/token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hostOk(req) || req.headers.get("x-tracker-token") !== getToken()) return Response.json({ error: "bad token" }, { status: 401 });
  const { platform, orders } = (await req.json()) as { platform: string; orders: unknown };
  if (!Array.isArray(orders)) return Response.json({ error: "bad payload" }, { status: 400 });
  const r = platform === "zomato" ? mapZomato(orders as ZomatoRaw[]) : platform === "swiggy" ? mapSwiggy(orders as SwiggyRaw[])
    : platform === "zepto" ? mapZepto(orders as ZeptoRaw[])
    : platform === "instamart" ? mapInstamart(orders as InstamartRaw[])
    : platform === "blinkit" ? mapBlinkit(orders as BlinkitRaw[])
    : null;
  if (!r) return Response.json({ error: "bad platform" }, { status: 400 });
  if (orders.length && !r.orders.length && r.skipped === orders.length && !orders.some((o) => o && typeof o === "object"))
    return Response.json({ error: "unrecognised response" }, { status: 422 });
  return Response.json({ ...upsertOrders(r.orders, "real"), skipped: r.skipped, received: orders.length });
}
