import fs from "node:fs";
import path from "node:path";
import { hostOk } from "@/lib/token";

export const dynamic = "force-dynamic";

/** Heartbeat from an open dashboard tab; the launcher stops the server when these stop. */
export async function POST(req: Request) {
  if (!hostOk(req)) return new Response("forbidden", { status: 403 });
  const dir = path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "last-ping"), String(Date.now()));
  return new Response(null, { status: 204 });
}
