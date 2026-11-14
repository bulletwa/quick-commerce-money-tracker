"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PLATFORM_LABEL } from "@/lib/types";
import { byCount, categorySpend, groupSum, heatmap, kpis, spendOverTime, topItems } from "@/lib/analytics";
import { PLATFORM_COLOR, inr } from "@/lib/format";
import { ItemDrill } from "../ItemDrill";
import { Art3D, categoryArt } from "../art/images";
import { useData } from "../app/Data";
import { FilterStrip } from "../app/FilterStrip";
import { Card, Empty, axisInr, tip } from "../app/ui";
import type { TabId } from "../app/route";

type Row = { key: string; label: string; value: number; right?: string; lead?: React.ReactNode; onPick?: () => void };

/** A ranked list drawn with plain bars: no axes to read, nothing to clip. Shows the top few, with "Show all" for the rest. */
function Bars({ rows, fmt = inr, top = 6, color = "var(--accent)" }: { rows: Row[]; fmt?: (n: number) => string; top?: number; color?: string }) {
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const shown = all ? rows : rows.slice(0, top);
  if (!rows.length) return <p className="text-sm text-muted">Nothing here for this selection.</p>;
  return (
    <div>
      <ol className="space-y-3">
        {shown.map((r, i) => {
          const inner = (
            <>
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center">{r.lead ?? <span className="text-sm font-semibold text-muted">{i + 1}</span>}</span>
                <span className="min-w-0 flex-1 break-words font-medium leading-snug">{r.label}</span>
                <span className="num shrink-0 font-semibold">{r.right ?? fmt(r.value)}</span>
              </div>
              <div className="ml-11 mt-1.5 h-2 overflow-hidden rounded-full bg-border"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} /></div>
            </>
          );
          return <li key={r.key}>{r.onPick ? <button className="block w-full rounded-lg text-left hover:bg-border/30" onClick={r.onPick}>{inner}</button> : inner}</li>;
        })}
      </ol>
      {rows.length > top && <button className="btn btn-quiet mt-3" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
    </div>
  );
}

const SECTIONS = [["overview", "Overview"], ["favourites", "Favourites"], ["where", "Where it goes"], ["when", "When"]] as const;
type Section = (typeof SECTIONS)[number][0];

function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, di) => (
          <div key={d} className="mb-[2px] flex items-center gap-[2px]">
            <span className="w-8 text-xs text-muted">{d}</span>
            {grid[di].map((c, h) => (
              <div key={h} title={`${d} ${h}:00: ${c} orders`} className="flex h-5 flex-1 items-center justify-center rounded-sm text-[9px] leading-none"
                style={{ background: `color-mix(in srgb, var(--c-ramp) ${c ? 14 + 86 * (c / max) : 5}%, transparent)`, color: c / max > 0.55 ? "var(--background)" : "var(--muted)" }}>{c || ""}</div>
            ))}
          </div>
        ))}
        <div className="ml-8 flex justify-between text-[10px] text-muted"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
        <div className="ml-8 mt-1 text-[10px] text-muted">Each square is the number of orders placed in that hour (darkest square: {max}).</div>
      </div>
    </div>
  );
}

export function Spending({ go }: { go: (t: TabId) => void }) {
  const { all, orders, f, conf, approx, cardPeriod, period } = useData();
  const [sec, setSec] = useState<Section>("overview");
  const [grain, setGrain] = useState<"month" | "week" | "day">("month");
  const [drill, setDrill] = useState<string | null>(null);

  const k = useMemo(() => kpis(orders), [orders]);
  const dishes = useMemo(() => topItems(orders, "food").sort(byCount), [orders]);
  const groceries = useMemo(() => topItems(orders, "grocery").sort(byCount), [orders]);
  const platform = useMemo(() => groupSum(orders, (o) => o.platform), [orders]);
  const cats = useMemo(() => categorySpend(orders), [orders]);
  const time = useMemo(() => spendOverTime(orders, grain), [orders, grain]);
  const vendors = useMemo(() => groupSum(orders.filter((o) => o.type === "food"), (o) => o.vendor as string), [orders]);
  const heat = useMemo(() => heatmap(orders), [orders]);
  const foodSum = useMemo(() => orders.filter((o) => o.type === "food").reduce((t, o) => t + o.total, 0), [orders]);
  const grocSum = useMemo(() => orders.filter((o) => o.type === "grocery").reduce((t, o) => t + o.total, 0), [orders]);

  if (!all) return <p className="text-muted">Loading…</p>;
  if (!all.length) return <Empty art={<Art3D name="receipt" size={96} />} title="Nothing to chart yet"><p>Once your orders are read, you&apos;ll see where the money goes: by month, app, category and favourite items.</p><button className="btn btn-primary" onClick={() => go("home")}>Go to Home</button></Empty>;

  const split = foodSum + grocSum || 1;
  const anyEst = [...dishes, ...groceries].some((r) => r.estimated > 0);
  const itemRows = (rows: typeof dishes): Row[] => rows.map((r) => ({ key: r.name, label: r.name, value: r.count, right: `${r.count}×`, onPick: () => setDrill(r.name) }));

  return (
    <div className="space-y-5">
      <h1 className="page-title">Spending</h1>
      <FilterStrip />

      {orders.length > 0 && <>
        <section className="card card-primary space-y-4" aria-label="Total">
          <div>
            <div className="text-sm text-muted">{f.categories.length || f.type || f.platforms.length ? "You spent (filtered)" : "You've spent"}</div>
            <div className="num big text-5xl">{approx ? "≈ " : ""}{inr(k.total)}</div>
            <div className="mt-1 text-sm text-muted">{period}{approx ? ` · between ${inr(conf.low)} and ${inr(conf.high)}` : ""}</div>
          </div>
          <div>
            <div className="flex h-3 overflow-hidden rounded-full bg-border" role="img" aria-label={`Food ${inr(foodSum)}, groceries ${inr(grocSum)}`}>
              <div style={{ width: `${(foodSum / split) * 100}%`, background: "var(--c-food)" }} /><div style={{ width: `${(grocSum / split) * 100}%`, background: "var(--c-grocery)" }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--c-food)" }} />Food {inr(foodSum)}</span>
              <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--c-grocery)" }} />Groceries {inr(grocSum)}</span>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
            {[["Orders", k.orders.toLocaleString("en-IN")], ["Average order", inr(k.avgOrder)], ["Per month", inr(k.perMonth)]].map(([l, v]) => (
              <div key={l}><dt className="text-muted">{l}</dt><dd className="num text-lg font-semibold">{v}</dd></div>
            ))}
          </dl>
        </section>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Spending sections">
          {SECTIONS.map(([id, label]) => <button key={id} className="chip" data-on={sec === id} aria-pressed={sec === id} onClick={() => setSec(id)}>{label}</button>)}
        </div>

        {sec === "overview" && (
          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="Over time" className="lg:col-span-3">
              <div className="mb-2 flex gap-2">
                {(["month", "week", "day"] as const).map((g) => <button key={g} className="chip" data-on={grain === g} aria-pressed={grain === g} onClick={() => setGrain(g)}>{g === "month" ? "By month" : g === "week" ? "By week" : "By day"}</button>)}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={time} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--muted)" minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" tickFormatter={axisInr} width={48} />
                  <Tooltip {...tip} /><Legend />
                  <Area type="monotone" dataKey="food" stackId="1" name="Food" stroke="var(--c-food)" fill="var(--c-food)" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="grocery" stackId="1" name="Grocery" stroke="var(--c-grocery)" fill="var(--c-grocery)" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
            <Card title="By app" className="lg:col-span-2">
              <Bars top={5} rows={platform.map((p) => ({ key: p.key, label: PLATFORM_LABEL[p.key], value: p.value, right: `${inr(p.value)} · ${Math.round((p.value / (k.total || 1)) * 100)}%`,
                lead: <span className="grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white" style={{ background: PLATFORM_COLOR[p.key] }} aria-hidden="true">{PLATFORM_LABEL[p.key][0]}</span> }))} />
            </Card>
          </div>
        )}

        {sec === "favourites" && <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Dishes you keep ordering"><Bars top={6} fmt={(n) => `${n}×`} rows={itemRows(dishes)} /></Card>
            <Card title="Groceries you keep buying"><Bars top={6} fmt={(n) => `${n}×`} color="var(--c-grocery)" rows={itemRows(groceries)} /></Card>
          </div>
          <p className="text-xs text-muted">Tap an item to see every order of it.{anyEst ? " Prices are estimated when an app doesn't report them." : ""}</p>
        </>}

        {sec === "where" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {f.categories.length !== 1 && <Card title="By category"><Bars top={6} rows={cats.map((c) => ({ key: c.name, label: c.name, value: c.value, lead: <Art3D name={categoryArt(c.name)} size={30} /> }))} /></Card>}
            <Card title="Restaurants you spend most at" className={f.categories.length === 1 ? "lg:col-span-2" : ""}><Bars top={6} rows={vendors.map((v) => ({ key: v.key, label: v.key, value: v.value }))} /></Card>
            <Card title="Fees, tips and savings" className="lg:col-span-2">
              <ul className="grid gap-3 text-sm sm:grid-cols-3">
                <li><div className="text-muted">Fees &amp; taxes</div><div className="num text-lg font-semibold">{k.fees > 0 ? inr(k.fees) : "Not recorded"}</div></li>
                <li><div className="text-muted">Tips</div><div className="num text-lg font-semibold">{k.tip > 0 ? inr(k.tip) : "None"}</div></li>
                <li><div className="text-muted">Saved with discounts</div><div className="num text-lg font-semibold">{k.discount > 0 ? inr(k.discount) : "Not recorded"}</div></li>
              </ul>
              {k.fees === 0 && <p className="mt-3 text-xs text-muted">Zomato, Blinkit and Zepto don&apos;t report fees, so they&apos;re already inside what you paid.</p>}
            </Card>
          </div>
        )}

        {sec === "when" && (
          <Card title="When you order"><Heatmap grid={heat} /></Card>
        )}
        <p className="text-xs text-muted">{cardPeriod}</p>
      </>}
      {drill && <ItemDrill orders={orders} name={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}
