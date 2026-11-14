import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Shared secret between this app and the Chrome extension, so other websites can't push data in. */
export function getToken() {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "token");
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(24).toString("hex"), { mode: 0o600 });
  return fs.readFileSync(file, "utf8").trim();
}

/** For writes: also refuse requests whose Origin is some other website (cross-site request forgery). */
export function sameOrigin(req: Request) {
  if (!hostOk(req)) return false;
  const o = req.headers.get("origin");
  return !o || o === `http://${req.headers.get("host")}`;
}

/** Reject DNS-rebinding: only accept requests addressed to localhost. */
export function hostOk(req: Request) {
  const h = (req.headers.get("host") ?? "").split(":")[0];
  return h === "127.0.0.1" || h === "localhost";
}
