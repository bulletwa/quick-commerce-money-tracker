"use client";
import { useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { METRICS, METRIC_LABEL, SCOPES, describeGoal, goalProgress, smartTips, suggestGoals, type Goal, type Metric, type Progress, type Scope } from "@/lib/goals";
import { inr } from "@/lib/format";

const COLOR = { ok: "#10b981", warn: "#f59e0b", over: "#ef4444" } as const;
const fmt = (m: Metric, n: number) => (m === "spend" ? inr(n) : String(Math.round(n)));
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
        <span className="text-lg font-semibold">{fmt(g.metric, p.value)} <span className="text-sm font-normal text-muted">of {fmt(g.metric, g.limit)}</span></span>
        <span style={{ color: COLOR[p.state] }}>{p.state === "over" ? `${fmt(g.metric, -p.remaining)} over` : `${fmt(g.metric, p.remaining)} left`}</span>
      </div>
      <div className="h-2 rounded bg-border"><div className="h-2 rounded" style={{ width: `${Math.min(100, p.pct * 100)}%`, background: COLOR[p.state] }} /></div>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-muted">
        <span>On pace for {fmt(g.metric, p.projected)}</span>
        {p.vsBaselinePct != null && (
          <span style={{ color: p.vsBaselinePct <= 0 ? COLOR.ok : COLOR.over }} title={`Your average over the previous months: ${fmt(g.metric, p.baseline)}`}>
            {p.vsBaselinePct <= 0 ? "▼" : "▲"} {Math.abs(Math.round(p.vsBaselinePct))}% vs your usual
          </span>
        )}
        {p.streak > 0 && <span>🔥 {p.streak} month{p.streak > 1 ? "s" : ""} on target</span>}
      </div>
      {p.history.length > 0 && (
        <div>
          <div className="relative flex h-10 items-end gap-1">
            {p.history.map((h) => (
              <div key={h.month} className="flex-1 rounded-sm" title={`${h.month}: ${fmt(g.metric, h.value)}${h.met ? "" : " (over)"}`}
                style={{ height: `${Math.max(4, (h.value / maxH) * 100)}%`, background: h.met ? COLOR.ok : COLOR.over, opacity: 0.8 }} />
            ))}
          </div>
          <div className="text-[10px] text-muted">Last {p.history.length} months (red = over the limit)</div>
        </div>
      )}
    </div>
  );
}

export function Goals({ orders }: { orders: Order[] }) {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState<{ scope: Scope; metric: Metric; limit: string; label: string }>({ scope: "food", metric: "orders", limit: "", label: "" });

  const call = async (init?: RequestInit, qs = "") => {
    try {
      const r = await fetch("/api/goals" + qs, init);
      if (!r.ok) throw new Error(await r.text());
      setGoals((await r.json()).goals);
      setErr("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not reach the goals service"); }
  };
  useEffect(() => { call(); }, []);

  const now = useMemo(() => new Date(), []);
  const progress = useMemo(() => (goals ?? []).map((g) => goalProgress(g, orders, now)), [goals, orders, now]);
  const tips = useMemo(() => smartTips(orders, now), [orders, now]);
  const suggestions = useMemo(() => suggestGoals(orders, now), [orders, now]);
  useEffect(() => { // tell the extension (if installed) how many goals are over/near their limit, for its icon badge
    if (goals) window.postMessage({ source: "mt-dashboard", type: "badge", over: progress.filter((p) => p.state === "over").length, warn: progress.filter((p) => p.state === "warn").length }, location.origin);
  }, [goals, progress]);
  const post = (body: unknown) => call({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const month = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const add = () => {
    const limit = Number(form.limit);
    if (!Number.isFinite(limit) || form.limit === "" || limit < 0) return setErr("Enter a limit of 0 or more.");
    const label = form.label.trim() || `${form.scope === "all" ? "All" : form.scope === "food" ? "Food" : "Grocery"} ${METRIC_LABEL[form.metric].toLowerCase()}`;
    post({ label, scope: form.scope, metric: form.metric, limit, ...(form.metric === "small_orders" ? { threshold: 200 } : {}) });
    setForm({ ...form, limit: "", label: "" });
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Budgets &amp; goals <span className="text-sm font-normal text-muted">· {month}</span></h2>

      {tips.length > 0 && (
        <div className="card">
          <h3 className="mb-2 text-sm font-medium text-muted">What your recent orders say</h3>
          <ul className="space-y-1 text-sm">{tips.map((t) => <li key={t.text}>{TIP_ICON[t.tone]} {t.text}</li>)}</ul>
        </div>
      )}

      {err && <p className="text-sm" style={{ color: COLOR.over }}>{err}</p>}

      {goals && goals.length === 0 && suggestions.length > 0 && (
        <div className="card space-y-2">
          <h3 className="text-sm font-medium">Suggested starting goals, based on your last 12 months</h3>
          <ul className="space-y-1 text-sm text-muted">{suggestions.map((s) => <li key={s.label}>• {describeGoal({ ...s, id: "" })}</li>)}</ul>
          <button className="btn btn-primary" onClick={() => post(suggestions)}>Add these goals</button>
        </div>
      )}

      {progress.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {progress.map((p) => <GoalCard key={p.goal.id} p={p} onDelete={() => call({ method: "DELETE" }, `?id=${encodeURIComponent(p.goal.id)}`)} />)}
        </div>
      )}

      <div className="card flex flex-wrap items-end gap-2 text-sm">
        <label className="space-y-1"><div className="text-xs text-muted">Applies to</div>
          <select className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as Scope })}>{SCOPES.map((s) => <option key={s} value={s}>{s === "all" ? "Food + grocery" : s}</option>)}</select></label>
        <label className="space-y-1"><div className="text-xs text-muted">Track</div>
          <select className="input" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value as Metric })}>{METRICS.map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}</select></label>
        <label className="space-y-1"><div className="text-xs text-muted">Monthly limit</div>
          <input className="input w-28" inputMode="numeric" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} placeholder={form.metric === "spend" ? "5000" : "8"} /></label>
        <label className="space-y-1"><div className="text-xs text-muted">Name (optional)</div>
          <input className="input w-48" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
        <button className="btn btn-primary" onClick={add}>Add goal</button>
      </div>
    </section>
  );
}
