"use client";
import { useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { HABIT_METRICS, METRICS, METRIC_LABEL, SCOPES, byMonth, describeGoal, goalProgress, limitFromAverage, metricValue, monthKey, recentAverage, smartTips, suggestGoals, type Goal, type Metric, type Progress, type Scope } from "@/lib/goals";
import { inr } from "@/lib/format";
import { api } from "@/lib/api";

const COLOR = { ok: "#10b981", warn: "#f59e0b", over: "#ef4444" } as const;
const fmt = (m: Metric, n: number) => (m === "spend" ? inr(n) : String(Math.round(n)));
/** with the unit spelled out, so "6 of 8" reads "6 of 8 orders" */
const fmtU = (m: Metric, n: number) => (m === "spend" ? inr(n) : `${Math.round(n)} ${Math.round(n) === 1 ? "order" : "orders"}`);
const TIP_ICON = { warn: "⚠️", info: "💡", good: "✅" } as const;

function GoalCard({ p, onDelete }: { p: Progress; onDelete: () => void }) {
  const { goal: g } = p;
  const maxH = Math.max(g.limit, ...p.history.map((h) => h.value), 1);
  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{g.label}</div>
          <div className="text-xs text-muted">{describeGoal(g)}</div>
        </div>
        <button className="text-xs text-muted hover:text-foreground" onClick={onDelete} aria-label={`Delete goal ${g.label}`}>Remove</button>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-lg font-semibold">{fmt(g.metric, p.value)} <span className="text-sm font-normal text-muted">of {fmtU(g.metric, g.limit)}</span></span>
        <span style={{ color: COLOR[p.state] }}>{p.state === "over" ? `${fmtU(g.metric, -p.remaining)} over` : `${fmtU(g.metric, p.remaining)} left`}</span>
      </div>
      <div className="h-2 rounded bg-border"><div className="h-2 rounded" style={{ width: `${Math.min(100, p.pct * 100)}%`, background: COLOR[p.state] }} /></div>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted">
        <span>On pace for {fmtU(g.metric, p.projected)} this month</span>
        {p.vsBaselinePct != null && (
          <span style={{ color: p.vsBaselinePct <= 0 ? COLOR.ok : COLOR.over }} title={`Your average over the previous months: ${fmtU(g.metric, p.baseline)} a month`}>
            {p.vsBaselinePct <= 0 ? "▼" : "▲"} {Math.abs(Math.round(p.vsBaselinePct))}% vs your usual
          </span>
        )}
        {p.streak > 0 && <span>🔥 {p.streak} month{p.streak > 1 ? "s" : ""} on target</span>}
      </div>
      {p.history.length > 0 && (
        <div>
          <div className="relative flex h-10 items-end gap-1">
            {p.history.map((h) => (
              <div key={h.month} className="flex-1 rounded-sm" title={`${h.month}: ${fmtU(g.metric, h.value)}${h.met ? "" : " (over)"}`}
                style={{ height: `${Math.max(4, (h.value / maxH) * 100)}%`, background: h.met ? COLOR.ok : COLOR.over, opacity: 0.8 }} />
            ))}
          </div>
          <div className="text-[10px] text-muted">Last {p.history.length} months (red = over the limit)</div>
        </div>
      )}
    </div>
  );
}

/**
 * `orders` are what the cards measure (the dashboard's filtered orders, minus the date range because goals are monthly);
 * `allOrders` are everything: limits, suggestions, tips and the toolbar badge never depend on the filters.
 */
export function Goals({ orders, allOrders, filterLabel, onClear }: { orders: Order[]; allOrders: Order[]; filterLabel?: string; onClear?: () => void }) {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(() => { try { return localStorage.getItem("mt-goals-open") !== "0"; } catch { return true; } });
  const toggleOpen = () => setOpen((v) => { try { localStorage.setItem("mt-goals-open", v ? "0" : "1"); } catch { /* preference only */ } return !v; });
  const [form, setForm] = useState<{ scope: Scope; metric: Metric; limit: string; label: string }>({ scope: "food", metric: "orders", limit: "", label: "" });

  const run = async (p: Promise<Goal[]>) => {
    try { setGoals(await p); setErr(""); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save the goal"); }
  };
  useEffect(() => { api.listGoals().then(setGoals, (e) => setErr(e instanceof Error ? e.message : "Could not load goals")); }, []);

  const now = useMemo(() => new Date(), []);
  const progress = useMemo(() => (goals ?? []).map((g) => goalProgress(g, orders, now)), [goals, orders, now]);
  const tips = useMemo(() => smartTips(allOrders, now), [allOrders, now]);
  const suggestions = useMemo(() => suggestGoals(allOrders, now), [allOrders, now]);
  const progressAll = useMemo(() => (goals ?? []).map((g) => goalProgress(g, allOrders, now)), [goals, allOrders, now]);
  useEffect(() => { // tell the extension (if installed) how many goals are over/near their limit, for its icon badge: always from all orders
    if (goals) api.reportBadge(progressAll.filter((p) => p.state === "over").length, progressAll.filter((p) => p.state === "warn").length);
  }, [goals, progressAll]);
  const formAvg = useMemo(() => recentAverage(allOrders, { scope: form.scope, metric: form.metric, threshold: 200 }, 2, now), [allOrders, form.scope, form.metric, now]);
  const post = (body: unknown) => run(api.saveGoals(body));
  const month = now.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const overN = progress.filter((p) => p.state === "over").length, warnN = progress.filter((p) => p.state === "warn").length, okN = progress.length - overN - warnN;
  const monthLine = useMemo(() => {
    const cur = byMonth(orders).get(monthKey(now)) ?? [];
    const f = metricValue(cur, { scope: "food", metric: "spend" }), g = metricValue(cur, { scope: "grocery", metric: "spend" });
    return `${now.getDate() === 1 ? "1" : `1–${now.getDate()}`} ${now.toLocaleString("en-IN", { month: "short" })}: ${inr(f + g)} spent (food ${inr(f)} · groceries ${inr(g)})`;
  }, [orders, now]);

  const add = () => {
    const limit = Number(form.limit);
    if (!Number.isFinite(limit) || form.limit === "" || limit < 0) return setErr("Enter a limit of 0 or more.");
    const label = form.label.trim() || `${form.scope === "all" ? "All" : form.scope === "food" ? "Food" : "Grocery"} ${METRIC_LABEL[form.metric].toLowerCase()}`;
    post({ label, scope: form.scope, metric: form.metric, limit, ...(form.metric === "small_orders" ? { threshold: 200 } : {}) });
    setForm({ ...form, limit: "", label: "" });
  };

  return (
    <section className="space-y-3">
      <button className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 text-left" onClick={toggleOpen} aria-expanded={open}>
        <h2 className="text-lg font-semibold">{open ? "▾" : "▸"} Budgets &amp; goals <span className="text-sm font-normal text-muted">· {month}</span></h2>
        <span className="text-sm text-muted">
          {monthLine} · {progress.length ? [overN && `${overN} over`, warnN && `${warnN} near limit`, okN && `${okN} on track`].filter(Boolean).join(", ") : "no goals yet"}
        </span>
      </button>
      {open && <>

      {filterLabel && (
        <div className="card flex flex-wrap items-center gap-2 text-sm">
          <span>Measuring only <b>{filterLabel}</b>.</span>
          <span className="text-muted">The limits stay the same, so these bars show how much of each budget that selection takes. The date range is ignored because goals are monthly.</span>
          {onClear && <button className="btn ml-auto" onClick={onClear}>Clear filters</button>}
        </div>
      )}

      {tips.length > 0 && (
        <div className="card">
          <h3 className="mb-2 text-sm font-medium text-muted">What your recent orders say</h3>
          <ul className="space-y-1 text-sm">{tips.map((t) => <li key={t.text}>{TIP_ICON[t.tone]} {t.text}</li>)}</ul>
        </div>
      )}

      {err && <p className="text-sm" style={{ color: COLOR.over }}>{err}</p>}

      {goals && goals.length === 0 && suggestions.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-medium">Suggested starting goals: your average of the last 2 full months</h3>
          <ul className="space-y-1 text-sm text-muted">{suggestions.map((s) => <li key={s.label}>• {describeGoal({ ...s, id: "" })}</li>)}</ul>
          <button className="btn btn-primary" onClick={() => post(suggestions)}>Add these goals</button>
        </div>
      )}

      {progress.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {progress.map((p) => <GoalCard key={p.goal.id} p={p} onDelete={() => run(api.deleteGoal(p.goal.id))} />)}
        </div>
      )}

      <div className="card flex flex-wrap items-end gap-2 text-sm">
        <label className="space-y-1"><div className="text-xs text-muted">Applies to</div>
          <select className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as Scope })}>{SCOPES.map((s) => <option key={s} value={s}>{s === "all" ? "Food + grocery" : s}</option>)}</select></label>
        <label className="space-y-1"><div className="text-xs text-muted">Track</div>
          <select className="input" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value as Metric })}><optgroup label="Spending">{METRICS.filter((m) => !HABIT_METRICS.includes(m)).map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}</optgroup>
            <optgroup label="Habits (only if you want them)">{HABIT_METRICS.map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}</optgroup></select></label>
        <label className="space-y-1"><div className="text-xs text-muted">Monthly limit</div>
          <input className="input w-28" inputMode="numeric" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} placeholder={form.metric === "spend" ? "5000" : "8"} /></label>
        {formAvg > 0 && (
          <button className="btn" onClick={() => setForm({ ...form, limit: String(limitFromAverage(form.metric, formAvg)) })} title="Average of the last 2 full months">
            Use 2-month avg ({fmtU(form.metric, limitFromAverage(form.metric, formAvg))})
          </button>
        )}
        <label className="space-y-1"><div className="text-xs text-muted">Name (optional)</div>
          <input className="input w-48" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
        <button className="btn btn-primary" onClick={add}>Add goal</button>
      </div>
      </>}
    </section>
  );
}
