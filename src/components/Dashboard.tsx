"use client";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Order } from "@/lib/types";
import { PLATFORM_LABEL } from "@/lib/types";
import { applyFilters, byCount, bySpend, categorySpend, emptyFilters, filterParts, groupSum, heatmap, insights, kpis, paidTotal, periodLabel, spendOverTime, topItems, type Filters } from "@/lib/analytics";
import { PALETTE, PLATFORM_COLOR, inr } from "@/lib/format";
import { FilterBar } from "./FilterBar";
import { FetchOrders } from "./FetchOrders";
import { ItemDrill } from "./ItemDrill";
import { Goals } from "./Goals";
import { Plan } from "./Plan";
import { Backup } from "./Backup";
import { AccuracyNote } from "./AccuracyNote";
import { ItemPrices } from "./ItemPrices";
import { confidence, reconcile, withAmounts, type Prices } from "@/lib/analytics/amounts";
import { api } from "@/lib/api";

const tip = { formatter: (v: unknown) => inr(Number(v)), contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 } };

type CardTotal = { value: string; sub?: string };

/** Every card that shows many numbers also shows their total, and the period that total covers. */
function Card({ title, total, className = "", children }: { title: string; total?: CardTotal; className?: string; children: React.ReactNode }) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted">{title}</h3>
        {total && <div className="shrink-0 text-base font-semibold leading-tight">{total.value}</div>}
      </div>
      {total?.sub && <div className="mt-0.5 text-[11px] leading-tight text-muted">{total.sub}</div>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const axisInr = (v: number) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`);
const short = (s: string, n = 24) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

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
          <div key={d} className="flex items-center gap-[2px] mb-[2px]">
            <span className="w-8 text-xs text-muted">{d}</span>
            {grid[di].map((c, h) => (
              <div key={h} title={`${d} ${h}:00: ${c} orders`} className="flex h-5 flex-1 items-center justify-center rounded-sm text-[9px] leading-none"
                style={{ background: `color-mix(in srgb, var(--accent) ${c ? 12 + 88 * (c / max) : 5}%, transparent)`, color: c / max > 0.45 ? "#fff" : "var(--muted)" }}>{c || ""}</div>
            ))}
          </div>
        ))}
        <div className="ml-8 flex justify-between text-[10px] text-muted"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
        <div className="ml-8 mt-1 text-[10px] text-muted">Each square is the number of orders placed in that hour (darkest square: {max}).</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [all, setAll] = useState<Order[] | null>(null);
  const [f, setF] = useState<Filters>(emptyFilters);
  const [grain, setGrain] = useState<"month" | "week" | "day">("month");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ k: "placedAt" | "total"; dir: 1 | -1 }>({ k: "placedAt", dir: -1 });
  const [open, setOpen] = useState<string | null>(null);
  const [drill, setDrill] = useState<string | null>(null);

  const [prices, setPrices] = useState<Prices>({});
  const load = () => { api.listPrices().then(setPrices).catch(() => {}); return api.loadOrders().then(setAll); };
  useEffect(() => { load(); }, []);

  // most-used categories first, so the filter bar can show the common ones and tuck the rest away
  const categories = useMemo(() => {
    const n = new Map<string, number>();
    for (const o of all ?? []) for (const i of o.items) n.set(i.category, (n.get(i.category) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  }, [all]);
  const withAmt = useMemo(() => withAmounts(all ?? [], prices), [all, prices]); // every item gets an amount: exact, your price, or estimated
  const orders = useMemo(() => applyFilters(withAmt, f), [withAmt, f]);
  // goals are monthly, so they follow every filter except the date range
  const goalOrders = useMemo(() => applyFilters(withAmt, { ...f, from: undefined, to: undefined }), [withAmt, f]);
  const conf = useMemo(() => confidence(orders), [orders]);
  const check = useMemo(() => reconcile(all ?? [], prices), [all, prices]);
  const approx = f.categories.length > 0 && conf.high - conf.low >= 1;
  const setPrice = async (name: string, price: number | null) => setPrices(await api.setPrice(name, price));
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
  const vendorsAll = useMemo(() => groupSum(orders.filter((o) => o.type === "food"), (o) => o.vendor as string), [orders]); // stores like "Blinkit" are one vendor per platform, so only restaurants are ranked
  const vendors = useMemo(() => vendorsAll.slice(0, 8), [vendorsAll]);
  const fees = useMemo(() => [{ name: "Item total", value: orders.reduce((s, o) => s + o.itemTotal, 0) }, { name: "Fees & taxes", value: k.fees }, { name: "Tips", value: k.tip }], [orders, k]);
  const lines = useMemo(() => insights(orders), [orders]);
  const paidOf = (o: Order) => o.fullTotal ?? o.total;
  const sorted = useMemo(() => [...orders].sort((a, b) => (sort.k === "total" ? paidOf(a) - paidOf(b) : a.placedAt.localeCompare(b.placedAt)) * sort.dir), [orders, sort]);
  const PAGE = 15;

  const parts = useMemo(() => filterParts(f), [f]);
  const hasFilter = parts.length > 0 || !!f.from || !!f.to;
  const period = useMemo(() => periodLabel(f, orders), [f, orders]);
  const cardPeriod = parts.length ? `${period} · filtered${approx ? " · estimate" : ""}` : period;
  const tot = (value: string, sub = cardPeriod): CardTotal => ({ value, sub });
  const sumBy = (rows: { count: number }[], n: number) => [rows.slice(0, n).reduce((t, r) => t + r.count, 0), rows.reduce((t, r) => t + r.count, 0)] as const;
  const sumSpend = (rows: { spend: number }[], n: number) => [rows.slice(0, n).reduce((t, r) => t + r.spend, 0), rows.reduce((t, r) => t + r.spend, 0)] as const;
  const foodSum = useMemo(() => orders.filter((o) => o.type === "food").reduce((t, o) => t + o.total, 0), [orders]);
  const grocSum = useMemo(() => orders.filter((o) => o.type === "grocery").reduce((t, o) => t + o.total, 0), [orders]);

  if (!all) return <p className="text-muted">Loading…</p>;
  if (!all.length)
    return (
      <div className="card text-center space-y-3 py-16">
        <h2 className="text-xl font-semibold">No orders yet</h2>
        <p className="text-muted">Log in to Zomato, Swiggy, Blinkit, Zepto and Instamart in this Chrome, then fetch your order history.</p>
        <div className="flex justify-center"><FetchOrders onDone={load} /></div>
        {api.backup && <div className="flex justify-center"><Backup onChange={load} /></div>}
      </div>
    );

  const dash = (n: number) => (n > 0 ? inr(n) : "—");
  const kpiCards: [string, string, string?][] = [
    ["Total spent", `${approx ? "≈ " : ""}${inr(k.total)}`, approx ? `Estimate. Between ${inr(conf.low)} and ${inr(conf.high)} (see the box above)` : undefined], ["Orders", String(k.orders)], ["Avg order", inr(k.avgOrder)],
    ["Per month", inr(k.perMonth)], ["Fees & taxes", dash(k.fees), k.fees > 0 ? undefined : "Not recorded for this selection (Zomato, Blinkit and Zepto don't report fees)"],
    ["Saved via discounts", dash(k.discount), k.discount > 0 ? undefined : "Not recorded for this selection"],
  ];
  const [dTop, dAll] = sumBy(dishes, 8), [gTop, gAll] = sumBy(groceries, 8), [sTop, sAll] = sumSpend(bySpendItems, 8);
  const anyEst = bySpendItems.some((r) => r.estimated > 0);
  const restTop = vendors.reduce((t, r) => t + r.value, 0), restAll = vendorsAll.reduce((t, r) => t + r.value, 0);
  const heat = heatmap(orders);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <FetchOrders onDone={load} />
        {api.backup && (
          <details className="relative ml-auto">
            <summary className="btn cursor-pointer list-none">Backup &amp; data ▾</summary>
            <div className="card absolute right-0 z-10 mt-1 w-max max-w-[90vw] shadow-lg"><Backup onChange={load} /></div>
          </details>
        )}
      </div>
      <FilterBar f={f} set={(n) => { setF(n); setPage(0); }} categories={categories} />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Showing {orders.length.toLocaleString("en-IN")} of {all.length.toLocaleString("en-IN")} orders</span>
        <span className="text-muted">· {period}{parts.length ? " · " + parts.join(" · ") : ""}</span>
        {hasFilter && <button className="btn ml-auto" onClick={() => { setF(emptyFilters); setPage(0); }}>Clear filters</button>}
      </div>
      {f.categories.length > 0 && <AccuracyNote conf={conf} check={check}><ItemPrices orders={orders} prices={prices} onSet={setPrice} /></AccuracyNote>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map(([l, v, hint]) => (
          <div key={l} className="card" title={hint}><div className="text-xs text-muted">{l}</div><div className="mt-1 text-xl font-semibold">{v}</div></div>
        ))}
      </div>

      <Card title="Highlights">
        <ul className="grid gap-1 text-sm md:grid-cols-2">{lines.map((l) => <li key={l}>• {l}</li>)}</ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Spend over time" className="lg:col-span-2" total={tot(inr(k.total), `Food ${inr(foodSum)} · Grocery ${inr(grocSum)} · ${cardPeriod}`)}>
          <div className="mb-2 flex gap-2">
            {(["month", "week", "day"] as const).map((g) => <button key={g} className="chip" data-on={grain === g} onClick={() => setGrain(g)}>{g}</button>)}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={time}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" tickFormatter={axisInr} />
              <Tooltip {...tip} />
              <Legend />
              <Area type="monotone" dataKey="food" stackId="1" name="Food" stroke="#e23744" fill="#e23744" fillOpacity={0.35} />
              <Area type="monotone" dataKey="grocery" stackId="1" name="Grocery" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
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
      {anyEst && <p className="-mt-2 text-xs text-muted">est. = estimated. Zomato, Blinkit, Zepto and Instamart don&apos;t report item prices, so each order&apos;s total is shared across its items.</p>}

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
              <Bar dataKey="value" fill="var(--accent)" radius={4}>
                <LabelList dataKey="value" position="right" formatter={(v: unknown) => inr(Number(v))} style={{ fontSize: 11, fill: "var(--muted)" }} />
              </Bar>
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
                <Pie data={fees} dataKey="value" nameKey="name" outerRadius={70}>{fees.map((_, i) => <Cell key={i} fill={["#4f46e5", "#f59e0b", "#10b981"][i]} />)}</Pie>
                <Tooltip {...tip} /><Legend formatter={(n, e) => `${n} · ${inr(Number((e.payload as { value?: number } | undefined)?.value ?? 0))}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted">No fees or tips were recorded for this selection, so everything you paid is item cost ({inr(fees[0].value)}).</p>}
        </Card>
      </div>

      <Plan orders={goalOrders} filterLabel={parts.length ? parts.join(" · ") : undefined} />

      <Goals orders={goalOrders} allOrders={all} filterLabel={parts.length ? parts.join(" · ") : undefined} onClear={() => { setF(emptyFilters); setPage(0); }} />

      <Card title={`Orders (${orders.length.toLocaleString("en-IN")})`} total={tot(inr(paidTotal(orders)), `total paid for these orders · ${cardPeriod}`)}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="cursor-pointer py-2" onClick={() => setPage(0) ?? setSort({ k: "placedAt", dir: sort.k === "placedAt" ? (-sort.dir as 1 | -1) : -1 })}>Date</th>
                <th>Platform</th><th>Vendor</th><th>{f.categories.length ? "Items (selected categories only)" : "Items"}</th>
                <th className="cursor-pointer text-right" onClick={() => setPage(0) ?? setSort({ k: "total", dir: sort.k === "total" ? (-sort.dir as 1 | -1) : -1 })}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(page * PAGE, (page + 1) * PAGE).map((o) => (
                <tr key={o.platform + o.id} className="cursor-pointer border-t border-border" onClick={() => setOpen(open === o.platform + o.id ? null : o.platform + o.id)}>
                  <td className="py-2 whitespace-nowrap">{new Date(o.placedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td><span className="rounded px-2 py-0.5 text-xs text-white" style={{ background: PLATFORM_COLOR[o.platform] }}>{PLATFORM_LABEL[o.platform]}</span></td>
                  <td>{o.vendor}</td>
                  <td className="max-w-md text-muted">
                    {open === o.platform + o.id
                      ? o.items.map((i) => <div key={i.rawName}>{i.qty}× {i.rawName} — {inr(i.amount ?? i.unitPrice * i.qty)} <span className="text-xs">{i.basis === "estimated" ? "est." : i.basis === "entered" ? "your price" : ""}</span></div>)
                      : <span className="line-clamp-1">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ") || "—"}</span>}
                  </td>
                  <td className="text-right font-medium">
                    {inr(paidOf(o))}
                    {o.partial && <div className="text-xs font-normal text-muted" title="Share of this order that belongs to the selected categories">selected {(o.hi ?? 0) - (o.lo ?? 0) < 0.5 ? "" : "≈ "}{inr(o.total)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">Page {page + 1} of {Math.max(1, Math.ceil(sorted.length / PAGE))}</span>
          <div className="flex gap-2">
            <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
            <button className="btn" disabled={(page + 1) * PAGE >= sorted.length} onClick={() => setPage(page + 1)}>Next</button>
            <button className="btn" onClick={() => exportCsv(sorted)}>Export CSV</button>
          </div>
        </div>
      </Card>
      {drill && <ItemDrill orders={orders} name={drill} onClose={() => setDrill(null)} />}
    </div>
  );
}

function exportCsv(orders: Order[]) {
  const rows = [["date", "platform", "type", "vendor", "items", "item_total", "fees", "discount", "tip", "total_paid", "selected_items_amount"],
    ...orders.map((o) => [o.placedAt, o.platform, o.type, o.vendor, o.items.map((i) => `${i.qty}x ${i.name}`).join("; "), o.itemTotal, o.fees, o.discount, o.tip, o.fullTotal ?? o.total, o.partial ? Math.round(o.total * 100) / 100 : ""])];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "orders.csv";
  a.click();
}
