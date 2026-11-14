import { getToken, hostOk } from "@/lib/token";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!hostOk(req)) return new Response("forbidden", { status: 403 });
  return Response.json({ token: getToken() });
}
