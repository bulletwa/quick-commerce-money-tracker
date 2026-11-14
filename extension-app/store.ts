// All data lives in chrome.storage.local, inside this browser profile. Nothing is sent anywhere.
import { categorize, normalizeName } from "../src/lib/enrich/categorize";
import { parseGoal, type Goal } from "../src/lib/goals";
import type { Order } from "../src/lib/types";

interface Row { data: Order; firstSeenAt: string }
type Rows = Record<string, Row>;
const key = (o: Pick<Order, "platform" | "id">) => `${o.platform}:${o.id}`;

async function read<T>(k: string, fallback: T): Promise<T> {
  const r = await chrome.storage.local.get(k);
  return (r[k] as T | undefined) ?? fallback;
}

// Fetches for several sites finish at different times; serialise read-modify-write so none overwrites another.
let chain: Promise<unknown> = Promise.resolve();
const exclusive = <T>(fn: () => Promise<T>): Promise<T> => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

export async function listOrders(): Promise<Order[]> {
  const rows = await read<Rows>("orders", {});
  return Object.values(rows)
    .map(({ data: o }) => ({
      // re-name and re-categorise on read so improved rules apply to already-imported orders
      ...o,
      items: o.items.map((i) => ({ ...i, name: normalizeName(i.rawName), category: categorize(i.rawName, o.type) })),
    }))
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

export function upsertOrders(orders: Order[]) {
  return exclusive(async () => {
    const rows = await read<Rows>("orders", {});
    const now = new Date().toISOString();
    let added = 0;
    for (const o of orders) {
      const k = key(o), prev = rows[k];
      if (!prev) added++;
      else if (!o.items.length && prev.data.items.length) { // a fetch that failed to read items must not wipe saved ones
        o.items = prev.data.items; o.itemsPriced = prev.data.itemsPriced;
      }
      rows[k] = { data: o, firstSeenAt: prev?.firstSeenAt ?? now };
    }
    await chrome.storage.local.set({ orders: rows });
    return { added, updated: orders.length - added };
  });
}

export const listGoals = () => read<Goal[]>("goals", []);
export function saveGoals(list: unknown) {
  return exclusive(async () => {
    const incoming = (Array.isArray(list) ? list : [list]).map(parseGoal);
    if (!incoming.length || incoming.length > 20 || incoming.some((g) => !g)) throw new Error("That goal isn't valid.");
    const goals = await listGoals();
    for (const g of incoming as Goal[]) { const i = goals.findIndex((x) => x.id === g.id); if (i >= 0) goals[i] = g; else goals.push(g); }
    await chrome.storage.local.set({ goals });
    return goals;
  });
}
export function deleteGoal(id: string) {
  return exclusive(async () => {
    const goals = (await listGoals()).filter((g) => g.id !== id);
    await chrome.storage.local.set({ goals });
    return goals;
  });
}

export async function exportJson() {
  const rows = await read<Rows>("orders", {});
  return JSON.stringify({ app: "money-tracker", version: 1, exportedAt: new Date().toISOString(), orders: Object.values(rows).map((r) => r.data), goals: await listGoals() }, null, 1);
}

const isOrder = (o: unknown): o is Order => {
  const x = o as Order;
  return !!x && typeof x.id === "string" && typeof x.platform === "string" && ["zomato", "swiggy", "instamart", "blinkit", "zepto"].includes(x.platform)
    && (x.type === "food" || x.type === "grocery") && typeof x.placedAt === "string" && !Number.isNaN(Date.parse(x.placedAt))
    && Number.isFinite(x.total) && Array.isArray(x.items) && typeof x.vendor === "string";
};
export async function importJson(text: string) {
  let j: { orders?: unknown[]; goals?: unknown[] };
  try { j = JSON.parse(text); } catch { throw new Error("That file isn't a Money Tracker backup."); }
  if (!j || !Array.isArray(j.orders)) throw new Error("That file isn't a Money Tracker backup.");
  const orders = j.orders.filter(isOrder);
  if (j.orders.length && !orders.length) throw new Error("No valid orders were found in that file.");
  await upsertOrders(orders);
  const goals = (j.goals ?? []).map(parseGoal).filter((g): g is Goal => !!g);
  if (goals.length) await saveGoals(goals);
  return { orders: orders.length, goals: goals.length };
}

export const clearAll = () => chrome.storage.local.remove(["orders", "goals"]);
