"use client";
import { useMemo } from "react";
import type { Order } from "@/lib/types";
import { monthlyPlan } from "@/lib/plan";
import { inr } from "@/lib/format";

const label = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" });

/** "How much do I put aside on the 1st?": built from the last 3 full months of spending. */
export function Plan({ orders, filterLabel }: { orders: Order[]; filterLabel?: string }) {
  const now = useMemo(() => new Date(), []);
  const p = useMemo(() => monthlyPlan(orders, now), [orders, now]);
  if (!p.months.length) return null;
  const maxBar = Math.max(1, ...p.months.map((m) => m.total), p.recommended.total);
  const used = p.recommended.total > 0 ? p.thisMonth.total / p.recommended.total : 0;
  const span = p.months.length === 1 ? label(p.months[0].month) : `${label(p.months[0].month)} to ${label(p.months[p.months.length - 1].month)}`;

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Monthly set-aside</h2>
          <div className="text-xs text-muted">
            Based on your last {p.months.length} full month{p.months.length === 1 ? "" : "s"} ({span}){filterLabel ? ` · only ${filterLabel}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Put aside on the 1st</div>
          <div className="text-3xl font-semibold">{inr(p.recommended.total)}</div>
          <div className="text-xs text-muted">≈ {inr(p.weekly)} a week</div>
        </div>
      </div>

      <p className="text-sm text-muted">
        That is your average month ({inr(p.tight.total)}) plus {inr(p.buffer)} of cushion, which is half the way to your busiest month ({inr(p.safe.total)}), so an ordinary spike is covered.
        {p.short && " You have fewer than 3 full months of orders so far, so treat this as rough."}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {[["Tight", "exactly your average", p.tight.total], ["Recommended", "average + cushion", p.recommended.total], ["Safe", "a month as busy as your busiest", p.safe.total]].map(([name, sub, v], i) => (
          <div key={name as string} className="rounded-lg border p-3" style={{ borderColor: i === 1 ? "var(--accent)" : "var(--border)" }}>
            <div className="text-xs text-muted">{name} <span className="text-[11px]">· {sub}</span></div>
            <div className="text-xl font-semibold">{inr(v as number)}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1 text-sm">
          <div className="text-xs text-muted">Where it goes</div>
          <div className="flex justify-between"><span>Food delivery</span><b>{inr(p.recommended.food)}</b></div>
          <div className="flex justify-between"><span>Groceries</span><b>{inr(p.recommended.grocery)}</b></div>
          <div className="mt-2 text-xs text-muted">The last months, for reference</div>
          {p.months.map((m) => (
            <div key={m.month} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-muted">{label(m.month)}</span>
              <div className="h-2 flex-1 rounded bg-border"><div className="h-2 rounded bg-accent" style={{ width: `${(m.total / maxBar) * 100}%` }} /></div>
              <span className="w-24 text-right">{inr(m.total)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-sm">
          <div className="text-xs text-muted">This month so far</div>
          <div className="flex items-baseline justify-between">
            <span><b className="text-lg">{inr(p.thisMonth.total)}</b> <span className="text-muted">of {inr(p.recommended.total)}</span></span>
            <span style={{ color: p.left < 0 ? "#ef4444" : used >= 0.8 ? "#f59e0b" : "#10b981" }}>{p.left < 0 ? `${inr(-p.left)} over` : `${inr(p.left)} left`}</span>
          </div>
          <div className="h-2 rounded bg-border"><div className="h-2 rounded" style={{ width: `${Math.min(100, used * 100)}%`, background: p.left < 0 ? "#ef4444" : used >= 0.8 ? "#f59e0b" : "#10b981" }} /></div>
          <div className="text-xs text-muted">Food {inr(p.thisMonth.food)} · Groceries {inr(p.thisMonth.grocery)}</div>
        </div>
      </div>
    </section>
  );
}
