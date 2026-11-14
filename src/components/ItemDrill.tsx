"use client";
import { useEffect } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Order } from "@/lib/types";
import { PLATFORM_LABEL } from "@/lib/types";
import { itemDetail } from "@/lib/analytics";
import { PLATFORM_COLOR, inr } from "@/lib/format";

const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 } };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hourLabel = (h: number) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });

function freq(gap: number | null, perMonth: number) {
  if (gap == null) return "Only ordered once";
  const every = gap < 1.5 ? "about once a day" : gap < 10 ? `about every ${Math.round(gap)} days` : gap < 45 ? `about every ${Math.round(gap / 7)} weeks` : `about every ${Math.round(gap / 30.44)} months`;
  return `${every} (${perMonth.toFixed(1)} per month)`;
}

export function ItemDrill({ orders, name, onClose }: { orders: Order[]; name: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const d = itemDetail(orders, name);
  const peakHour = d ? d.byHour.indexOf(Math.max(...d.byHour)) : 0;
  const peakDay = d ? d.byWeekday.indexOf(Math.max(...d.byWeekday)) : 0;
  const approx = !!d && d.estimated > 0;
  const stat = (l: string, v: string, sub?: string) => (
    <div className="card !p-3"><div className="text-xs text-muted">{l}</div><div className="mt-0.5 text-lg font-semibold">{v}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</div>
  );
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{name}</h2>
            <p className="text-xs text-muted">Within your current filters</p>
          </div>
          <button className="btn" onClick={onClose}>Close ✕</button>
        </div>
        {!d ? <p className="text-muted">No orders for this item in the current filters.</p> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {stat("Units ordered", String(d.units), `in ${d.orders} orders`)}
              {stat(approx ? "Money spent (≈)" : "Money spent", (approx ? "≈ " : "") + inr(d.spend), approx ? "estimated from order totals" : undefined)}
              {stat("Per order", inr(d.spend / d.orders), `${(d.units / d.orders).toFixed(1)} units`)}
              {stat("First → last", day(d.first), "→ " + day(d.last))}
            </div>
            <div className="card !p-3 text-sm">
              <b>Frequency:</b> {freq(d.avgGapDays, d.perMonth)}. <b>Peak time:</b> around {hourLabel(peakHour)}, most often on <b>{DAYS[peakDay]}</b>.
            </div>
            {approx && (
              <p className="text-xs text-muted">
                {inr(d.estimated)} of this is an estimate: Zomato, Blinkit, Zepto and Instamart don&apos;t give per-item prices, so each order&apos;s total (including its fees) is shared across its items.
                Orders with a single item are accurate to the fees.
              </p>
            )}
            <section className="card !p-3">
              <h3 className="mb-2 text-sm font-medium text-muted">By time of day (units)</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={d.byHour.map((v, h) => ({ h: hourLabel(h), v }))}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="h" tick={{ fontSize: 10 }} interval={2} stroke="var(--muted)" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="var(--muted)" width={28} />
                  <Tooltip {...tip} /><Bar dataKey="v" name="Units" fill="var(--accent)" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className="card !p-3">
              <h3 className="mb-2 text-sm font-medium text-muted">By day of week (units)</h3>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={d.byWeekday.map((v, i) => ({ d: DAYS[i], v }))}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} stroke="var(--muted)" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="var(--muted)" width={28} />
                  <Tooltip {...tip} /><Bar dataKey="v" name="Units" fill="#10b981" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className="card !p-3">
              <h3 className="mb-2 text-sm font-medium text-muted">Over time (units per month)</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={d.byMonth}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} stroke="var(--muted)" minTickGap={24} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="var(--muted)" width={28} />
                  <Tooltip {...tip} /><Bar dataKey="units" name="Units" fill="#f59e0b" radius={2} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <div className="grid gap-3 md:grid-cols-2">
              <section className="card !p-3 text-sm">
                <h3 className="mb-2 text-sm font-medium text-muted">By platform</h3>
                {d.platforms.map((p) => (
                  <div key={p.key} className="flex justify-between py-0.5">
                    <span><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: PLATFORM_COLOR[p.key] }} />{PLATFORM_LABEL[p.key as keyof typeof PLATFORM_LABEL]}</span>
                    <span className="text-muted">{p.units}× · {approx ? "≈ " : ""}{inr(p.spend)}</span>
                  </div>
                ))}
              </section>
              {d.vendors.length > 0 && (
                <section className="card !p-3 text-sm">
                  <h3 className="mb-2 text-sm font-medium text-muted">From which restaurants</h3>
                  {d.vendors.map((v) => <div key={v.key} className="flex justify-between py-0.5"><span className="truncate">{v.key}</span><span className="text-muted">{v.units}×</span></div>)}
                </section>
              )}
            </div>
            <section className="card !p-3 text-sm">
              <h3 className="mb-2 text-sm font-medium text-muted">Recent orders</h3>
              {d.recent.slice(0, 10).map((r) => (
                <div key={r.platform + r.id} className="flex justify-between gap-2 border-t border-border py-1.5 first:border-0">
                  <span className="truncate">{new Date(r.placedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {r.vendor}</span>
                  <span className="shrink-0 text-muted">{r.qty}× · {r.estimated ? "≈ " : ""}{inr(r.amount)}</span>
                </div>
              ))}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
