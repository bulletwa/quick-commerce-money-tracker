"use client";
import { useState } from "react";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/types";
import type { Filters } from "@/lib/analytics";

export function FilterBar({ f, set, categories }: { f: Filters; set: (f: Filters) => void; categories: string[] }) {
  const [allCats, setAllCats] = useState(false);
  const shown = allCats ? categories : categories.filter((c, i) => i < 10 || f.categories.includes(c));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const preset = (days: number) => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - days);
    set({ ...f, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
  };
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className="input" value={f.from ?? ""} onChange={(e) => set({ ...f, from: e.target.value || undefined })} />
        <span className="text-muted text-sm">to</span>
        <input type="date" className="input" value={f.to ?? ""} onChange={(e) => set({ ...f, to: e.target.value || undefined })} />
        {[["30d", 30], ["90d", 90], ["1y", 365]].map(([l, d]) => (
          <button key={l} className="btn" onClick={() => preset(d as number)}>{l}</button>
        ))}
        <button className="btn" onClick={() => set({ ...f, from: undefined, to: undefined })}>All time</button>
        <input className="input ml-auto w-56" placeholder="Search dish, item or store…" value={f.q ?? ""} onChange={(e) => set({ ...f, q: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted w-16">Platform</span>
        {PLATFORMS.map((p) => (
          <button key={p} className="chip" data-on={f.platforms.includes(p)} onClick={() => set({ ...f, platforms: toggle(f.platforms, p) })}>{PLATFORM_LABEL[p]}</button>
        ))}
        <span className="text-xs text-muted ml-4">Type</span>
        {(["food", "grocery"] as const).map((t) => (
          <button key={t} className="chip" data-on={f.type === t} onClick={() => set({ ...f, type: f.type === t ? undefined : t })}>{t === "food" ? "Food" : "Grocery"}</button>
        ))}
        <span className="text-xs text-muted ml-4">Order ₹</span>
        <input type="number" className="input w-20" placeholder="min" value={f.minTotal ?? ""} onChange={(e) => set({ ...f, minTotal: e.target.value ? +e.target.value : undefined })} />
        <input type="number" className="input w-20" placeholder="max" value={f.maxTotal ?? ""} onChange={(e) => set({ ...f, maxTotal: e.target.value ? +e.target.value : undefined })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted w-16">Category</span>
        {shown.map((c) => (
          <button key={c} className="chip" data-on={f.categories.includes(c)} onClick={() => set({ ...f, categories: toggle(f.categories, c) })}>{c}</button>
        ))}
        {categories.length > 10 && <button className="chip" onClick={() => setAllCats(!allCats)}>{allCats ? "Show fewer" : `More (${categories.length - shown.length}) ▾`}</button>}
        <button className="btn ml-auto" onClick={() => set({ platforms: [], categories: [] })}>Reset</button>
      </div>
    </div>
  );
}
