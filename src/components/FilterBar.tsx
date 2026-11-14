"use client";
import { useState } from "react";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/types";
import { Art3D, categoryArt } from "./art/images";
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
  const extra = (f.from || f.to ? 1 : 0) + (f.minTotal != null || f.maxTotal != null ? 1 : 0) + f.categories.length;
  const [more, setMore] = useState(false);
  const label = (on: boolean) => ({ "data-on": on, "aria-pressed": on });
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input min-w-0 flex-1 basis-48" type="search" aria-label="Search dish, item or store" autoComplete="off" spellCheck={false} placeholder="Search a dish, item or store…" value={f.q ?? ""} onChange={(e) => set({ ...f, q: e.target.value })} />
        {[["30 days", 30], ["90 days", 90], ["1 year", 365]].map(([l, d]) => <button key={l} className="btn" onClick={() => preset(d as number)}>{l}</button>)}
        <button className="btn" onClick={() => set({ ...f, from: undefined, to: undefined })}>All time</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {PLATFORMS.map((p) => <button key={p} className="chip" {...label(f.platforms.includes(p))} onClick={() => set({ ...f, platforms: toggle(f.platforms, p) })}>{PLATFORM_LABEL[p]}</button>)}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {(["food", "grocery"] as const).map((t) => <button key={t} className="chip" {...label(f.type === t)} onClick={() => set({ ...f, type: f.type === t ? undefined : t })}>{t === "food" ? "Food" : "Grocery"}</button>)}
        <button className="chip ml-auto" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Fewer filters ▴" : `More filters${extra ? ` (${extra})` : ""} ▾`}</button>
      </div>
      {more && <div className="space-y-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs text-muted">Dates</span>
          <input type="date" className="input" aria-label="From date" value={f.from ?? ""} onChange={(e) => set({ ...f, from: e.target.value || undefined })} />
          <span className="text-sm text-muted">to</span>
          <input type="date" className="input" aria-label="To date" value={f.to ?? ""} onChange={(e) => set({ ...f, to: e.target.value || undefined })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs text-muted">Order ₹</span>
          <input type="number" className="input w-24" aria-label="Minimum order amount" inputMode="numeric" autoComplete="off" placeholder="min" value={f.minTotal ?? ""} onChange={(e) => set({ ...f, minTotal: e.target.value ? +e.target.value : undefined })} />
          <input type="number" className="input w-24" aria-label="Maximum order amount" inputMode="numeric" autoComplete="off" placeholder="max" value={f.maxTotal ?? ""} onChange={(e) => set({ ...f, maxTotal: e.target.value ? +e.target.value : undefined })} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-20 text-xs text-muted">Category</span>
          {shown.map((c) => <button key={c} className="chip" {...label(f.categories.includes(c))} onClick={() => set({ ...f, categories: toggle(f.categories, c) })}><Art3D name={categoryArt(c)} size={18} />{c}</button>)}
          {categories.length > 10 && <button className="chip" onClick={() => setAllCats(!allCats)}>{allCats ? "Show fewer" : `More (${categories.length - shown.length}) ▾`}</button>}
        </div>
      </div>}
    </div>
  );
}
