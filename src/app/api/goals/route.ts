import { deleteGoal, listGoals, saveGoal } from "@/lib/db";
import { parseGoal } from "@/lib/goals";
import { hostOk, sameOrigin } from "@/lib/token";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!hostOk(req)) return new Response("forbidden", { status: 403 });
  return Response.json({ goals: listGoals() });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => null);
  const list = Array.isArray(body) ? body : [body];
  const goals = list.map(parseGoal);
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
