import type { Api, FetchEvent } from "./api-types";
import type { Prices } from "./analytics/amounts";
import type { Goal } from "./goals";

/** Web (local server) implementation. The Chrome-extension build swaps this module for extension-app/api.ts. */
async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api: Api = {
  loadOrders: () => fetch("/api/orders").then((r) => json<{ orders: never[] }>(r)).then((d) => d.orders),
  listGoals: () => fetch("/api/goals").then((r) => json<{ goals: Goal[] }>(r)).then((d) => d.goals),
  saveGoals: (g) => fetch("/api/goals", post(g)).then((r) => json<{ goals: Goal[] }>(r)).then((d) => d.goals),
  deleteGoal: (id) => fetch(`/api/goals?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) => json<{ goals: Goal[] }>(r)).then((d) => d.goals),

  listPrices: () => fetch("/api/prices").then((r) => json<{ prices: Prices }>(r)).then((d) => d.prices),
  setPrice: (name, price) => fetch("/api/prices", post({ name, price })).then((r) => json<{ prices: Prices }>(r)).then((d) => d.prices),

  canFetch: () =>
    new Promise<boolean>((resolve) => {
      const on = (e: MessageEvent) => { if (e.source === window && e.data?.source === "mt-extension" && e.data.type === "pong") { cleanup(); resolve(true); } };
      const t = setTimeout(() => { cleanup(); resolve(false); }, 1500);
      const cleanup = () => { window.removeEventListener("message", on); clearTimeout(t); };
      window.addEventListener("message", on);
      window.postMessage({ source: "mt-dashboard", type: "ping" }, location.origin);
    }),

  async fetchOrders(platforms, on) {
    const token = (await fetch("/api/token").then((r) => r.json())).token as string;
    await new Promise<void>((resolve) => {
      const imports: Promise<void>[] = [];
      const handler = (e: MessageEvent) => {
        const m = e.data;
        if (e.source !== window || m?.source !== "mt-extension") return;
        if (m.type === "progress" || m.type === "error") on(m as FetchEvent);
        else if (m.type === "orders") {
          imports.push(
            fetch("/api/fetch-import", { method: "POST", headers: { "content-type": "application/json", "x-tracker-token": token }, body: JSON.stringify({ platform: m.platform, orders: m.orders }) })
              .then((r) => r.json())
              .then((j) => on(j.error ? { type: "error", platform: m.platform, error: j.error } : { type: "imported", platform: m.platform, added: j.added, updated: j.updated, skipped: j.skipped })),
          );
        } else if (m.type === "done") {
          window.removeEventListener("message", handler);
          Promise.all(imports).then(() => resolve());
        }
      };
      window.addEventListener("message", handler);
      window.postMessage({ source: "mt-dashboard", type: "fetch", platforms }, location.origin);
    });
    on({ type: "done" });
  },

  async checkConnections(platforms, on) { platforms.forEach((p) => on(p, "unknown")); }, // the local web build cannot look inside other sites

  reportBadge(over, warn) { window.postMessage({ source: "mt-dashboard", type: "badge", over, warn }, location.origin); },
};
