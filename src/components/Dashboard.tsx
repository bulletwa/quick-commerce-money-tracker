"use client";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Order } from "@/lib/types";
import { PLATFORM_LABEL } from "@/lib/types";
import { applyFilters, byCount, bySpend, categorySpend, emptyFilters, groupSum, heatmap, insights, kpis, spendOverTime, topItems, type Filters } from "@/lib/analytics";
import { PALETTE, PLATFORM_COLOR, inr } from "@/lib/format";
import { FilterBar } from "./FilterBar";
import { FetchOrders } from "./FetchOrders";
import { ItemDrill } from "./ItemDrill";
import { Goals } from "./Goals";
import { Backup } from "./Backup";
import { api } from "@/lib/api";

const tip = { formatter: (v: unknown) => inr(Number(v)), contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 } };

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <h3 className="mb-3 text-sm font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}

function TopList({ rows, metric, onPick }: { rows: { name: string; count: number; spend: number; estimated: number }[]; metric: "count" | "spend"; onPick: (name: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r[metric]));
  if (!rows.length) return <p className="text-sm text-muted">No data for these filters.</p>;
  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.name} className="text-sm">
          <button className="block w-full rounded px-1 py-1 text-left hover:bg-border/40" onClick={() => onPick(r.name)} title="Click for details">
            <div className="flex justify-between gap-2">
              <span className="truncate">{i + 1}. {r.name}</span>
              <span className="shrink-0 text-muted" title={r.estimated ? "Estimated: this platform gives no item prices, so the order total is shared across its items" : undefined}>
                {r.count}× · {r.estimated ? "≈ " : ""}{inr(r.spend)}
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
              <div key={h} title={`${d} ${h}:00 — ${c} orders`} className="h-5 flex-1 rounded-sm" style={{ background: "var(--accent)", opacity: c ? 0.12 + 0.88 * (c / max) : 0.05 }} />
            ))}
          </div>
        ))}
        <div className="ml-8 flex justify-between text-[10px] text-muted"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
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

  const load = () => api.loadOrders().then(setAll);
  useEffect(() => { load(); }, []);

  const categories = useMemo(() => [...new Set((all ?? []).flatMap((o) => o.items.map((i) => i.category)))].sort(), [all]);
  const orders = useMemo(() => applyFilters(all ?? [], f), [all, f]);
  const k = useMemo(() => kpis(orders), [orders]);
  const dishes = useMemo(() => topItems(orders, "food"), [orders]);
  const groceries = useMemo(() => topItems(orders, "grocery"), [orders]);
  const everything = useMemo(() => topItems(orders), [orders]);
  const platform = useMemo(() => groupSum(orders, (o) => o.platform).map((r) => ({ name: PLATFORM_LABEL[r.key], key: r.key, value: r.value, orders: r.orders })), [orders]);
  const cats = useMemo(() => categorySpend(orders), [orders]);
  const time = useMemo(() => spendOverTime(orders, grain), [orders, grain]);
  const vendors = useMemo(() => groupSum(orders.filter((o) => o.type === "food"), (o) => o.vendor as string).slice(0, 8), [orders]); // stores like "Blinkit" are one vendor per platform, so only restaurants are ranked
  const fees = useMemo(() => [{ name: "Item total", value: orders.reduce((s, o) => s + o.itemTotal, 0) }, { name: "Fees & taxes", value: k.fees }, { name: "Tips", value: k.tip }], [orders, k]);
  const lines = useMemo(() => insights(orders), [orders]);
  const sorted = useMemo(() => [...orders].sort((a, b) => (sort.k === "total" ? a.total - b.total : a.placedAt.localeCompare(b.placedAt)) * sort.dir), [orders, sort]);
  const PAGE = 15;

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

  const kpiCards = [
    ["Total spent", inr(k.total)], ["Orders", String(k.orders)], ["Avg order", inr(k.avgOrder)],
    ["Per month", inr(k.perMonth)], ["Fees & taxes", inr(k.fees)], ["Saved via discounts", inr(k.discount)],
  ];

  return (
    <div className="space-y-4">
      <div className="card space-y-3"><FetchOrders onDone={load} />{api.backup && <Backup onChange={load} />}</div>
      <FilterBar f={f} set={(n) => { setF(n); setPage(0); }} categories={categories} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map(([l, v]) => (
          <div key={l} className="card"><div className="text-xs text-muted">{l}</div><div className="mt-1 text-xl font-semibold">{v}</div></div>
        ))}
      </div>

      <Goals orders={all} />

      <Card title="Highlights">
        <ul className="grid gap-1 text-sm md:grid-cols-2">{lines.map((l) => <li key={l}>• {l}</li>)}</ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Spend over time" className="lg:col-span-2">
          <div className="mb-2 flex gap-2">
            {(["month", "week", "day"] as const).map((g) => <button key={g} className="chip" data-on={grain === g} onClick={() => setGrain(g)}>{g}</button>)}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={time}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" tickFormatter={(v) => "₹" + v / 1000 + "k"} />
              <Tooltip {...tip} />
              <Legend />
              <Area type="monotone" dataKey="food" stackId="1" name="Food" stroke="#e23744" fill="#e23744" fillOpacity={0.35} />
              <Area type="monotone" dataKey="grocery" stackId="1" name="Grocery" stroke="#10b981" fill="#10b981" fillOpacity={0.35} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Spend by platform">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={platform} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {platform.map((p) => <Cell key={p.key} fill={PLATFORM_COLOR[p.key]} />)}
              </Pie>
              <Tooltip {...tip} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Most ordered dishes"><TopList rows={dishes.sort(byCount).slice(0, 8)} metric="count" onPick={setDrill} /></Card>
        <Card title="Most bought groceries"><TopList rows={groceries.sort(byCount).slice(0, 8)} metric="count" onPick={setDrill} /></Card>
        <Card title="Where the money went (top items by spend)"><TopList rows={everything.sort(bySpend).slice(0, 8)} metric="spend" onPick={setDrill} /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Spend by category">
          <ResponsiveContainer width="100%" height={Math.max(300, cats.length * 26)}>
            <BarChart data={cats} layout="vertical" margin={{ left: 40 }} barCategoryGap={4}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted)" tickFormatter={(v) => "₹" + v / 1000 + "k"} />
              <YAxis type="category" dataKey="name" width={130} interval={0} tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <Tooltip {...tip} />
              <Bar dataKey="value" radius={4}>{cats.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Top restaurants by spend (food orders)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={vendors} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted)" tickFormatter={(v) => "₹" + v / 1000 + "k"} />
              <YAxis type="category" dataKey="key" width={130} interval={0} tick={{ fontSize: 11 }} stroke="var(--muted)" />
              <Tooltip {...tip} />
              <Bar dataKey="value" fill="var(--accent)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="When you order (day × hour)" className="lg:col-span-2"><Heatmap grid={heatmap(orders)} /></Card>
        <Card title="Where each rupee goes">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={fees} dataKey="value" nameKey="name" outerRadius={70}>{fees.map((_, i) => <Cell key={i} fill={["#4f46e5", "#f59e0b", "#10b981"][i]} />)}</Pie>
              <Tooltip {...tip} /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title={`Orders (${orders.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="cursor-pointer py-2" onClick={() => setPage(0) ?? setSort({ k: "placedAt", dir: sort.k === "placedAt" ? (-sort.dir as 1 | -1) : -1 })}>Date</th>
                <th>Platform</th><th>Vendor</th><th>Items</th>
                <th className="cursor-pointer text-right" onClick={() => setPage(0) ?? setSort({ k: "total", dir: sort.k === "total" ? (-sort.dir as 1 | -1) : -1 })}>Total</th>
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
                      ? o.items.map((i) => <div key={i.rawName}>{i.qty}× {i.rawName} — {inr(i.unitPrice * i.qty)}</div>)
                      : <span className="line-clamp-1">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ") || "—"}</span>}
                  </td>
                  <td className="text-right font-medium">{inr(o.total)}</td>
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
  const rows = [["date", "platform", "type", "vendor", "items", "item_total", "fees", "discount", "tip", "total"],
    ...orders.map((o) => [o.placedAt, o.platform, o.type, o.vendor, o.items.map((i) => `${i.qty}x ${i.name}`).join("; "), o.itemTotal, o.fees, o.discount, o.tip, o.total])];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "orders.csv";
  a.click();
}
