import { listPrices, setPrice } from "@/lib/db";
import { parsePrice } from "@/lib/analytics/amounts";
import { hostOk, sameOrigin } from "@/lib/token";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!hostOk(req)) return new Response("forbidden", { status: 403 });
  return Response.json({ prices: listPrices() });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("forbidden", { status: 403 });
  const b = (await req.json().catch(() => null)) as { name?: unknown; price?: unknown } | null;
  const p = b ? parsePrice(b.name, b.price) : null;
  if (!p) return new Response("invalid price", { status: 400 });
  setPrice(p.name, p.price);
  return Response.json({ prices: listPrices() });
}
