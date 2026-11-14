"use client";
import { useState } from "react";
import { inr } from "@/lib/format";

export const tip = { formatter: (v: unknown) => inr(Number(v)), contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 } };
export const axisInr = (v: number) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`);
export const short = (s: string, n = 24) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export type CardTotal = { value: string; sub?: string };

/** Every card that shows many numbers also shows their total, and the period that total covers. */
export function Card({ title, total, className = "", children }: { title: string; total?: CardTotal; className?: string; children: React.ReactNode }) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted">{title}</h3>
        {total && <div className="num shrink-0 text-base font-semibold leading-tight">{total.value}</div>}
      </div>
      {total?.sub && <div className="mt-0.5 text-[11px] leading-tight text-muted">{total.sub}</div>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** A designed empty state: says what is missing, what will appear, and offers one way forward. */
export function Empty({ art, title, children }: { art: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <div className="bob">{art}</div>
      <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
      <div className="max-w-md space-y-3 text-muted">{children}</div>
    </div>
  );
}

/** A one-time hint next to the thing it explains. Dismissed for good (per browser); fine if storage is blocked. */
export function Tip({ id, children }: { id: string; children: React.ReactNode }) {
  const key = `mt-tip-${id}`;
  const [gone, setGone] = useState(() => { try { return localStorage.getItem(key) === "1"; } catch { return false; } });
  if (gone) return null;
  return (
    <div className="tile flex items-start gap-3 text-sm" role="note">
      <span aria-hidden="true">💡</span>
      <span className="min-w-0 flex-1">{children}</span>
      <button className="btn btn-quiet shrink-0" onClick={() => { setGone(true); try { localStorage.setItem(key, "1"); } catch { /* hint only */ } }}>Got it</button>
    </div>
  );
}
