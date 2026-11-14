"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { inr } from "@/lib/format";
import { monthlyPlan } from "@/lib/plan";
import { buildStories } from "@/lib/stories";
import type { Goal } from "@/lib/goals";
import { Art3D } from "../art/images";
import { Setup } from "../app/Setup";
import { useData } from "../app/Data";
import { FetchButton, FetchStatus, useFetch } from "../app/Fetch";
import type { TabId } from "../app/route";

const hello = () => { const h = new Date().getHours(); return h < 5 ? "Hello, night owl" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** The month at a glance: one ring, one honest sentence about it. Colour is never the only signal. */
function Ring({ spent, limit }: { spent: number; limit: number }) {
  const pct = limit > 0 ? spent / limit : 0;
  const state = pct > 1 ? "over" : pct >= 0.8 ? "warn" : "ok";
  const color = { ok: "var(--good)", warn: "var(--warn)", over: "var(--bad)" }[state];
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="64" cy="64" r={R} fill="none" stroke="var(--border)" strokeWidth="14" />
          <circle cx="64" cy="64" r={R} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, pct))} style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.2,0.8,0.2,1)" }} />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center"><div><div className="big text-2xl">{Math.round(pct * 100)}%</div><div className="text-xs text-muted">of {inr(limit)}</div></div></div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm text-muted">This month so far</div>
        <div className="num big text-4xl">{inr(spent)}</div>
        <div className="font-semibold" style={{ color }}>
          {state === "over" ? `Over your limit by ${inr(spent - limit)}` : state === "warn" ? `Close to your limit: ${inr(limit - spent)} left` : `On track: ${inr(limit - spent)} left`}
        </div>
      </div>
    </div>
  );
}

export function Home({ go }: { go: (t: TabId) => void }) {
  const { all, withAmt } = useData();
  const { finished } = useFetch();
  const [goals, setGoals] = useState<Goal[]>([]);
  useEffect(() => { api.listGoals().then(setGoals).catch(() => {}); }, []);
  const plan = useMemo(() => monthlyPlan(withAmt), [withAmt]);
  const stories = useMemo(() => buildStories(withAmt), [withAmt]);
  const spendGoal = goals.find((g) => g.metric === "spend" && g.scope === "all");
  const limit = spendGoal?.limit ?? (plan.months.length ? plan.recommended.total : 0);
  const last = useMemo(() => { void finished; try { const v = Number(localStorage.getItem("mt-last-read")); return v || null; } catch { return null; } }, [finished]);

  if (!all) return <p className="text-muted">Loading…</p>;
  if (!all.length) return <Setup go={go} />;
  return (
    <div className="space-y-5">
      <h1 className="page-title">{hello()}</h1>

      <section className="card card-primary space-y-4" aria-label="This month">
        {limit > 0 ? <Ring spent={plan.thisMonth.total} limit={limit} /> : (
          <div className="space-y-1"><div className="text-sm text-muted">This month so far</div><div className="num big text-4xl">{inr(plan.thisMonth.total)}</div></div>
        )}
        <p className="text-xs text-muted">{limit > 0 ? (spendGoal ? "Your own monthly spending limit." : "Based on the average of your last full months, with a cushion.") : "Set a monthly limit in Goals to see how you're doing."}</p>
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <FetchButton />
          <span className="text-sm text-muted">{last ? `Last read ${ago(last)}` : "Read new orders to keep this up to date."}</span>
        </div>
        <FetchStatus />
      </section>

      {stories.length > 0 && (
        <section aria-label="About you">
          <h2 className="mb-2 text-lg font-semibold">About you</h2>
          <ul className="stories">
            {stories.map((s, i) => (
              <li key={s.id} className="story rise" style={{ animationDelay: `${i * 70}ms` }}>
                <Art3D name={s.art} size={56} />
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">{s.kicker}</div>
                <div className="text-xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>{s.headline}</div>
                <div className="text-sm text-muted">{s.detail}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Shortcuts">
        <button className="card tile-link text-left" onClick={() => go("goals")}>
          <Art3D name="money-bag" size={44} />
          <div><div className="font-semibold">Monthly set-aside</div><div className="text-sm text-muted">{plan.months.length ? `Put aside about ${inr(plan.recommended.total)} at the start of the month.` : "See how much to keep aside each month."}</div></div>
        </button>
        <button className="card tile-link text-left" onClick={() => go("spending")}>
          <Art3D name="receipt" size={44} />
          <div><div className="font-semibold">All your spending</div><div className="text-sm text-muted">Charts by month, app and category.</div></div>
        </button>
      </section>
    </div>
  );
}
