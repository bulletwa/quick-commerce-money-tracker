import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { categorize, normalizeName } from "./enrich/categorize";
import type { Order } from "./types";
import type { Goal } from "./goals";

const DIR = path.join(process.cwd(), ".data");
let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(DIR, { recursive: true });
  db = new Database(path.join(DIR, "orders.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS orders (
    platform TEXT NOT NULL, id TEXT NOT NULL, placed_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'real', data TEXT NOT NULL,
    PRIMARY KEY (platform, id))`);
  db.exec("CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL)");
  if (!(db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]).some((c) => c.name === "first_seen_at"))
    db.exec("ALTER TABLE orders ADD COLUMN first_seen_at TEXT");
  return db;
}

export function upsertOrders(orders: Order[], source: "real" | "sample" = "real") {
  const d = getDb();
  const stmt = d.prepare(
    `INSERT INTO orders (platform,id,placed_at,source,data,first_seen_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(platform,id) DO UPDATE SET placed_at=excluded.placed_at, data=excluded.data, source=excluded.source`,
  );
  const prev = d.prepare("SELECT data FROM orders WHERE platform=? AND id=?");
  const now = new Date().toISOString();
  let added = 0;
  d.transaction((rows: Order[]) => {
    for (const o of rows) {
      const row = prev.get(o.platform, o.id) as { data: string } | undefined;
      if (!row) added++;
      else if (!o.items.length) {
        // a fetch that failed to read an order's items must not wipe the ones saved earlier
        const old = JSON.parse(row.data) as Order;
        if (old.items.length) { o.items = old.items; o.itemsPriced = old.itemsPriced; }
      }
      stmt.run(o.platform, o.id, o.placedAt, source, JSON.stringify(o), now);
    }
  })(orders);
  return { added, updated: orders.length - added };
}

export function listOrders(): { orders: Order[]; hasSample: boolean } {
  const rows = getDb()
    .prepare("SELECT data, source FROM orders ORDER BY placed_at DESC")
    .all() as { data: string; source: string }[];
  return {
    // re-name and re-categorise on read so improved rules apply to already-imported orders
    orders: rows.map((r) => {
      const o = JSON.parse(r.data) as Order;
      o.items = o.items.map((i) => ({ ...i, name: normalizeName(i.rawName), category: categorize(i.rawName, o.type) }));
      return o;
    }),
    hasSample: rows.some((r) => r.source === "sample"),
  };
}

export function clearOrders(source?: "sample") {
  if (source) getDb().prepare("DELETE FROM orders WHERE source=?").run(source);
  else getDb().exec("DELETE FROM orders");
}

export function listGoals(): Goal[] {
  return (getDb().prepare("SELECT data FROM goals ORDER BY created_at, id").all() as { data: string }[]).map((r) => JSON.parse(r.data) as Goal);
}
export function saveGoal(g: Goal) {
  getDb().prepare("INSERT INTO goals (id,data,created_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
    .run(g.id, JSON.stringify(g), new Date().toISOString());
}
export function deleteGoal(id: string) { getDb().prepare("DELETE FROM goals WHERE id=?").run(id); }
