import crypto from "node:crypto";
import { deleteGoal, listGoals, saveGoal } from "@/lib/db";
import { METRICS, SCOPES, type Goal } from "@/lib/goals";
import { hostOk, sameOrigin } from "@/lib/token";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!hostOk(req)) return new Response("forbidden", { status: 403 });
  return Response.json({ goals: listGoals() });
}

function parse(b: unknown): Goal | null {
  if (!b || typeof b !== "object") return null;
  const x = b as Record<string, unknown>;
  const limit = Number(x.limit);
  const threshold = x.threshold == null ? undefined : Number(x.threshold);
  if (!SCOPES.includes(x.scope as never) || !METRICS.includes(x.metric as never)) return null;
  if (!Number.isFinite(limit) || limit < 0 || limit > 1e7) return null;
  if (threshold != null && (!Number.isFinite(threshold) || threshold < 0 || threshold > 1e6)) return null;
  const label = String(x.label ?? "").trim().slice(0, 80);
  if (!label) return null;
  const id = typeof x.id === "string" && /^[\w-]{1,40}$/.test(x.id) ? x.id : crypto.randomUUID();
  return { id, label, scope: x.scope as Goal["scope"], metric: x.metric as Goal["metric"], limit, ...(x.metric === "small_orders" ? { threshold: threshold ?? 200 } : {}) };
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => null);
  const list = Array.isArray(body) ? body : [body];
  const goals = list.map(parse);
  if (!goals.length || goals.length > 20 || goals.some((g) => !g)) return new Response("invalid goal", { status: 400 });
  for (const g of goals) saveGoal(g!);
  return Response.json({ goals: listGoals() });
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return new Response("forbidden", { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });
  deleteGoal(id);
  return Response.json({ goals: listGoals() });
}
