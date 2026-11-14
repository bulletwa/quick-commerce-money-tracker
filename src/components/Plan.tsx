"use client";
import { useMemo } from "react";
import type { Order } from "@/lib/types";
import { monthlyPlan } from "@/lib/plan";
import { inr } from "@/lib/format";
import { BillArt } from "./art/illustrations";

const label = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" });

/** "How much do I put aside on the 1st?": built from the last 3 full months of spending. */
export function Plan({ orders, filterLabel }: { orders: Order[]; filterLabel?: string }) {
  const now = useMemo(() => new Date(), []);
  const p = useMemo(() => monthlyPlan(orders, now), [orders, now]);
  if (!p.months.length) return null;
  const maxBar = Math.max(1, ...p.months.map((m) => m.total), p.recommended.total);
  const used = p.recommended.total > 0 ? p.thisMonth.total / p.recommended.total : 0;
  const span = p.months.length === 1 ? label(p.months[0].month) : `${label(p.months[0].month)} to ${label(p.months[p.months.length - 1].month)}`;

  const tone = p.left < 0 ? "var(--bad)" : used >= 0.8 ? "var(--warn)" : "var(--good)";
  return (
    <section className="card card-primary bill space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="art hidden text-foreground sm:block"><BillArt size={56} /></div>
          <div>
            <h2>Monthly set-aside</h2>
            <div className="text-xs text-muted">
              Based on your last {p.months.length} full month{p.months.length === 1 ? "" : "s"} ({span}){filterLabel ? ` · only ${filterLabel}` : ""}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Put aside on the 1st</div>
          <div className="num text-3xl font-semibold">{inr(p.recommended.total)}</div>
          <div className="text-xs text-muted">≈ <span className="num">{inr(p.weekly)}</span> a week</div>
        </div>
      </div>

      <p className="text-sm text-muted">
        That is your average month (<span className="num">{inr(p.tight.total)}</span>) plus <span className="num">{inr(p.buffer)}</span> of cushion, which is half the way to your busiest month (<span className="num">{inr(p.safe.total)}</span>), so an ordinary spike is covered.
        {p.short && " You have fewer than 3 full months of orders so far, so treat this as rough."}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {[["Tight", "exactly your average", p.tight.total], ["Recommended", "average + cushion", p.recommended.total], ["Safe", "a month as busy as your busiest", p.safe.total]].map(([name, sub, v], i) => (
          <div key={name as string} className="border p-3" style={{ borderColor: i === 1 ? "var(--accent)" : "var(--border)", borderWidth: i === 1 ? 2 : 1, borderRadius: "var(--radius-sm)" }}>
            <div className="text-xs text-muted">{name} <span className="text-[11px]">· {sub}</span></div>
            <div className="num text-xl font-semibold">{inr(v as number)}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          <div className="text-xs text-muted">Where it goes</div>
          <div className="leader"><span>Food delivery</span><i /><b className="num">{inr(p.recommended.food)}</b></div>
          <div className="leader"><span>Groceries</span><i /><b className="num">{inr(p.recommended.grocery)}</b></div>
          <div className="leader border-t border-border pt-1.5 font-semibold"><span>Total to set aside</span><i /><b className="num">{inr(p.recommended.total)}</b></div>
          <div className="pt-2 text-xs text-muted">The last months, for reference</div>
          {p.months.map((m) => (
            <div key={m.month} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-muted">{label(m.month)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-border"><div className="fillbar h-2 w-full rounded bg-accent" style={{ transform: `scaleX(${m.total / maxBar})` }} /></div>
              <span className="num w-24 text-right">{inr(m.total)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-2 text-sm">
          <div className="text-xs text-muted">This month so far</div>
          <div className="flex items-baseline justify-between">
            <span><b className="num text-lg">{inr(p.thisMonth.total)}</b> <span className="text-muted">of <span className="num">{inr(p.recommended.total)}</span></span></span>
            <span className="num" style={{ color: tone }}>{p.left < 0 ? `${inr(-p.left)} over` : `${inr(p.left)} left`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-border"><div className="fillbar h-2 w-full rounded" style={{ transform: `scaleX(${Math.min(1, used)})`, background: tone }} /></div>
          <div className="text-xs text-muted">Food <span className="num">{inr(p.thisMonth.food)}</span> · Groceries <span className="num">{inr(p.thisMonth.grocery)}</span></div>
        </div>
      </div>
    </section>
  );
}
