"use client";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PLATFORM_LABEL } from "@/lib/types";
import { byCount, bySpend, categorySpend, groupSum, heatmap, insights, kpis, spendOverTime, topItems } from "@/lib/analytics";
import { PALETTE, PLATFORM_COLOR, inr } from "@/lib/format";
import { ItemDrill } from "../ItemDrill";
import { Art3D } from "../art/images";
import { useData } from "../app/Data";
import { FilterStrip } from "../app/FilterStrip";
import { Card, Empty, Tip, axisInr, short, tip, type CardTotal } from "../app/ui";
import type { TabId } from "../app/route";

function TopList({ rows, metric, onPick }: { rows: { name: string; count: number; spend: number; estimated: number; orders: number }[]; metric: "count" | "spend"; onPick: (name: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  if (!rows.length) return <p className="text-sm text-muted">No data for these filters.</p>;
  if (metric === "count" && rows[0].orders < 2) return <p className="text-sm text-muted">Nothing has been ordered more than once in this selection yet.</p>;
  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.name} className="text-sm">
          <button className="block w-full rounded px-1 py-1 text-left hover:bg-border/40" onClick={() => onPick(r.name)} title="Click for details">
            <div className="flex justify-between gap-2">
              <span className="truncate">{i + 1}. {r.name}</span>
              <span className="shrink-0 text-muted" title={r.estimated ? "Estimated: this platform gives no item prices, so the order total is shared across its items" : undefined}>
                {r.count}× · {r.estimated ? "est. " : ""}{inr(r.spend)}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-border"><div className="h-1.5 rounded bg-accent" style={{ width: `${(r[metric] / max) * 100}%` }} /></div>
          </button>
        </li>
      ))}
    </ol>
  );
}

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
  const { all, orders, f, conf, approx, cardPeriod } = useData();
  const [grain, setGrain] = useState<"month" | "week" | "day">("month");
  const [drill, setDrill] = useState<string | null>(null);

  const k = useMemo(() => kpis(orders), [orders]);
  const dishes = useMemo(() => topItems(orders, "food").sort(byCount), [orders]);
  const groceries = useMemo(() => topItems(orders, "grocery").sort(byCount), [orders]);
  const bySpendItems = useMemo(() => topItems(orders).sort(bySpend), [orders]);
  const platform = useMemo(() => {
    const rows = groupSum(orders, (o) => o.platform);
    const sum = rows.reduce((t, r) => t + r.value, 0) || 1;
    return rows.map((r) => ({ label: `${PLATFORM_LABEL[r.key]} · ${inr(r.value)} (${Math.round((r.value / sum) * 100)}%)`, key: r.key, value: r.value, orders: r.orders }));
  }, [orders]);
  const cats = useMemo(() => categorySpend(orders), [orders]);
  const time = useMemo(() => spendOverTime(orders, grain), [orders, grain]);
  const vendorsAll = useMemo(() => groupSum(orders.filter((o) => o.type === "food"), (o) => o.vendor as string), [orders]);
  const vendors = useMemo(() => vendorsAll.slice(0, 8), [vendorsAll]);
  const fees = useMemo(() => [{ name: "Item total", value: orders.reduce((s, o) => s + o.itemTotal, 0) }, { name: "Fees & taxes", value: k.fees }, { name: "Tips", value: k.tip }], [orders, k]);
  const lines = useMemo(() => insights(orders), [orders]);
  const heat = useMemo(() => heatmap(orders), [orders]);
  const foodSum = useMemo(() => orders.filter((o) => o.type === "food").reduce((t, o) => t + o.total, 0), [orders]);
  const grocSum = useMemo(() => orders.filter((o) => o.type === "grocery").reduce((t, o) => t + o.total, 0), [orders]);

  if (!all) return <p className="text-muted">Loading…</p>;
  if (!all.length) return <Empty art={<Art3D name="receipt" size={96} />} title="Nothing to chart yet"><p>Once your orders are read, you&apos;ll see where the money goes: by month, platform, category and favourite items.</p><button className="btn btn-primary" onClick={() => go("home")}>Go to Home</button></Empty>;

  const tot = (value: string, sub = cardPeriod): CardTotal => ({ value, sub });
  const sumBy = (rows: { count: number }[], n: number) => [rows.slice(0, n).reduce((t, r) => t + r.count, 0), rows.reduce((t, r) => t + r.count, 0)] as const;
  const sumSpend = (rows: { spend: number }[], n: number) => [rows.slice(0, n).reduce((t, r) => t + r.spend, 0), rows.reduce((t, r) => t + r.spend, 0)] as const;
  const dash = (n: number) => (n > 0 ? inr(n) : "—");
  const kpiCards: [string, string, string?][] = [
    ["Total spent", `${approx ? "≈ " : ""}${inr(k.total)}`, approx ? `Estimate. Between ${inr(conf.low)} and ${inr(conf.high)}` : undefined], ["Orders", String(k.orders)], ["Avg order", inr(k.avgOrder)],
    ["Per month", inr(k.perMonth)], ["Fees & taxes", dash(k.fees), k.fees > 0 ? undefined : "Not recorded for this selection (Zomato, Blinkit and Zepto don't report fees)"],
    ["Saved via discounts", dash(k.discount), k.discount > 0 ? undefined : "Not recorded for this selection"],
  ];
  const [dTop, dAll] = sumBy(dishes, 8), [gTop, gAll] = sumBy(groceries, 8), [sTop, sAll] = sumSpend(bySpendItems, 8);
  const anyEst = bySpendItems.some((r) => r.estimated > 0);
  const restTop = vendors.reduce((t, r) => t + r.value, 0), restAll = vendorsAll.reduce((t, r) => t + r.value, 0);

  return (
    <div className="space-y-4">
      <h1 className="page-title">Spending</h1>
      <Tip id="spending">Tap any dish or item in the lists to see every time you ordered it. Use the filters to look at one app, one category or one stretch of time.</Tip>
      <FilterStrip />
      {orders.length > 0 && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {kpiCards.map(([l, v, hint]) => (
            <div key={l} className="card card-primary rise" title={hint}><div className="text-xs text-muted">{l}</div><div className="num mt-1 text-xl font-semibold">{v}</div></div>
          ))}
        </div>

        <Card title="Highlights"><ul className="grid gap-1 text-sm md:grid-cols-2">{lines.map((l) => <li key={l}>• {l}</li>)}</ul></Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Spend over time" className="lg:col-span-2" total={tot(inr(k.total), `Food ${inr(foodSum)} · Grocery ${inr(grocSum)} · ${cardPeriod}`)}>
            <div className="mb-2 flex gap-2">
              {(["month", "week", "day"] as const).map((g) => <button key={g} className="chip" data-on={grain === g} aria-pressed={grain === g} onClick={() => setGrain(g)}>{g}</button>)}
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={time}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" tickFormatter={axisInr} />
                <Tooltip {...tip} /><Legend />
                <Area type="monotone" dataKey="food" stackId="1" name="Food" stroke="var(--c-food)" fill="var(--c-food)" fillOpacity={0.28} />
                <Area type="monotone" dataKey="grocery" stackId="1" name="Grocery" stroke="var(--c-grocery)" fill="var(--c-grocery)" fillOpacity={0.28} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Spend by platform" total={tot(inr(k.total), `${k.orders.toLocaleString("en-IN")} orders · ${cardPeriod}`)}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={platform} dataKey="value" nameKey="label" cy="38%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {platform.map((p) => <Cell key={p.key} fill={PLATFORM_COLOR[p.key]} />)}
                </Pie>
                <Tooltip {...tip} /><Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Most ordered dishes" total={tot(`${dTop} of ${dAll}`, `dishes ordered (top 8 of all) · ${cardPeriod}`)}><TopList rows={dishes.slice(0, 8)} metric="count" onPick={setDrill} /></Card>
          <Card title="Most bought groceries" total={tot(`${gTop} of ${gAll}`, `units bought (top 8 of all) · ${cardPeriod}`)}><TopList rows={groceries.slice(0, 8)} metric="count" onPick={setDrill} /></Card>
          <Card title="Where the money went (top items by spend)" total={tot(`${anyEst ? "est. " : ""}${inr(sTop)} of ${inr(sAll)}`, `top 8 items of all · ${cardPeriod}`)}><TopList rows={bySpendItems.slice(0, 8)} metric="spend" onPick={setDrill} /></Card>
        </div>
        {anyEst && <p className="-mt-2 text-xs text-muted">est. = estimated. Some platforms don&apos;t report item prices, so each order&apos;s total is shared across its items.</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          {f.categories.length !== 1 && (
            <Card title="Spend by category" total={tot(inr(cats.reduce((t, c) => t + c.value, 0)), cardPeriod)}>
              <ResponsiveContainer width="100%" height={Math.max(300, cats.length * 26)}>
                <BarChart data={cats} layout="vertical" margin={{ left: 40, right: 56 }} barCategoryGap={4}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted)" tickFormatter={axisInr} />
                  <YAxis type="category" dataKey="name" width={130} interval={0} tick={{ fontSize: 11 }} stroke="var(--muted)" />
                  <Tooltip {...tip} />
                  <Bar dataKey="value" radius={4}>
                    {cats.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    <LabelList dataKey="value" position="right" formatter={(v: unknown) => inr(Number(v))} style={{ fontSize: 11, fill: "var(--muted)" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
          <Card title="Top restaurants by spend (food orders)" className={f.categories.length === 1 ? "lg:col-span-2" : ""} total={tot(`${inr(restTop)} of ${inr(restAll)}`, `top 8 of all restaurants · ${cardPeriod}`)}>
            {vendors.length === 0 ? <p className="text-sm text-muted">No restaurant orders in this selection.</p> : <ResponsiveContainer width="100%" height={300}>
              <BarChart data={vendors} layout="vertical" margin={{ left: 40, right: 56 }}>
                <CartesianGrid stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted)" tickFormatter={axisInr} />
                <YAxis type="category" dataKey="key" width={150} interval={0} tick={{ fontSize: 11 }} stroke="var(--muted)" tickFormatter={(v: string) => short(v, 22)} />
                <Tooltip {...tip} />
                <Bar dataKey="value" fill="var(--accent)" radius={4}><LabelList dataKey="value" position="right" formatter={(v: unknown) => inr(Number(v))} style={{ fontSize: 11, fill: "var(--muted)" }} /></Bar>
              </BarChart>
            </ResponsiveContainer>}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="When you order (day × hour)" className="lg:col-span-2" total={tot(`${k.orders.toLocaleString("en-IN")} orders`, cardPeriod)}><Heatmap grid={heat} /></Card>
          <Card title="Where each rupee goes" total={tot(inr(k.total), cardPeriod)}>
            {k.fees + k.tip > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={fees} dataKey="value" nameKey="name" outerRadius={70}>{fees.map((_, i) => <Cell key={i} fill={["var(--accent)", "var(--warn)", "var(--c-food)"][i]} />)}</Pie>
                  <Tooltip {...tip} /><Legend formatter={(n, e) => `${n} · ${inr(Number((e.payload as { value?: number } | undefined)?.value ?? 0))}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted">No fees or tips were recorded for this selection, so everything you paid is item cost ({inr(fees[0].value)}).</p>}
          </Card>
        </div>
      </>}
      {drill && <ItemDrill orders={orders} name={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}
