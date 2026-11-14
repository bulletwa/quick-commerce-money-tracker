"use client";
import { useState } from "react";
import type { Prices } from "@/lib/analytics/amounts";
import type { Order } from "@/lib/types";
import { inr } from "@/lib/format";

/** Items in the current selection whose amounts are guesses (or that you already priced), biggest first, with a box for what you usually pay. */
export function ItemPrices({ orders, prices, onSet }: { orders: Order[]; prices: Prices; onSet: (name: string, price: number | null) => Promise<void> }) {
  const rows = new Map<string, { name: string; units: number; orders: number; basis: string }>();
  for (const o of orders) {
    const seen = new Set<string>();
    for (const i of o.items) {
      if (i.basis === "exact") continue;
      const r = rows.get(i.name) ?? { name: i.name, units: 0, orders: 0, basis: i.basis ?? "estimated" };
      r.units += i.qty;
      if (!seen.has(i.name)) { r.orders++; seen.add(i.name); }
      rows.set(i.name, r);
    }
  }
  const top = [...rows.values()].sort((a, b) => b.units - a.units).slice(0, 8);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  if (!top.length) return null;

  const save = async (name: string) => {
    const raw = (draft[name] ?? "").trim();
    if (raw === "") return;
    const n = Number(raw.replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(n) || n <= 0) { setErr("Enter a price above 0."); return; }
    try { await onSet(name, n); setErr(""); setDraft((d) => { const { [name]: _drop, ...rest } = d; return rest; }); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save the price."); }
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">Make it exact: enter what you usually pay for one unit. Platforms like Blinkit and Zepto don&apos;t report item prices.</div>
      <ul className="space-y-1">
        {top.map((r) => (
          <li key={r.name} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate" title={r.name}>{r.name} <span className="text-muted">· {r.units} units in {r.orders} orders</span></span>
            {prices[r.name] != null && <span className="text-xs text-muted">your price {inr(prices[r.name])}</span>}
            <span className="text-muted">₹</span>
            <input className="input w-24" inputMode="decimal" placeholder={prices[r.name] != null ? String(prices[r.name]) : "per unit"} value={draft[r.name] ?? ""}
              aria-label={`Usual price of ${r.name}`}
              onChange={(e) => setDraft({ ...draft, [r.name]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save(r.name)} />
            <button className="btn" onClick={() => save(r.name)} disabled={!(draft[r.name] ?? "").trim()}>Save</button>
            {prices[r.name] != null && <button className="btn" onClick={() => onSet(r.name, null).catch((e) => setErr(String(e?.message ?? e)))}>Clear</button>}
          </li>
        ))}
      </ul>
      {err && <p className="text-xs" style={{ color: "#ef4444" }}>{err}</p>}
    </div>
  );
}
