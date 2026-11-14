"use client";
import { useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { PLATFORM_LABEL } from "@/lib/types";
import { paidTotal } from "@/lib/analytics";
import { PLATFORM_COLOR, inr } from "@/lib/format";
import { Art3D } from "../art/images";
import { useData } from "../app/Data";
import { FilterStrip } from "../app/FilterStrip";
import { Card, Empty, Tip } from "../app/ui";
import type { TabId } from "../app/route";

const PAGE = 15;
const paidOf = (o: Order) => o.fullTotal ?? o.total;

export function OrdersTab({ go }: { go: (t: TabId) => void }) {
  const { all, orders, f, cardPeriod } = useData();
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ k: "placedAt" | "total"; dir: 1 | -1 }>({ k: "placedAt", dir: -1 });
  const [open, setOpen] = useState<string | null>(null);
  const sorted = useMemo(() => [...orders].sort((a, b) => (sort.k === "total" ? paidOf(a) - paidOf(b) : a.placedAt.localeCompare(b.placedAt)) * sort.dir), [orders, sort]);
  const flip = (k: "placedAt" | "total") => { setPage(0); setSort({ k, dir: sort.k === k ? (-sort.dir as 1 | -1) : -1 }); };

  if (!all) return <p className="text-muted">Loading…</p>;
  if (!all.length) return <Empty art={<Art3D name="shopping-bags" size={96} />} title="No orders yet"><p>Every order you place on Zomato, Swiggy, Instamart, Blinkit and Zepto will be listed here, with the exact items.</p><button className="btn btn-primary" onClick={() => go("home")}>Go to Home</button></Empty>;

  return (
    <div className="space-y-4">
      <h1 className="page-title">Orders</h1>
      <Tip id="orders">On a wide screen, click an order to see each item and what it cost. The Paid column shows what you actually paid, fees included.</Tip>
      <FilterStrip onChange={() => setPage(0)} />
      {orders.length > 0 && (
        <Card title={`Orders (${orders.length.toLocaleString("en-IN")})`} total={{ value: inr(paidTotal(orders)), sub: `total paid for these orders · ${cardPeriod}` }}>
          <ul className="space-y-2 md:hidden">
            {sorted.slice(page * PAGE, (page + 1) * PAGE).map((o) => (
              <li key={o.platform + o.id} className="tile space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold">{o.vendor}</span>
                  <span className="num shrink-0 font-semibold">{inr(paidOf(o))}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="rounded px-1.5 py-0.5 text-white" style={{ background: PLATFORM_COLOR[o.platform] }}>{PLATFORM_LABEL[o.platform]}</span>
                  {new Date(o.placedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </div>
                <div className="line-clamp-2 text-sm text-muted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ") || "—"}</div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2" aria-sort={sort.k === "placedAt" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}><button className="font-medium" onClick={() => flip("placedAt")}>Date {sort.k === "placedAt" ? (sort.dir === 1 ? "↑" : "↓") : ""}</button></th>
                  <th>Platform</th><th>Vendor</th><th>{f.categories.length ? "Items (selected categories only)" : "Items"}</th>
                  <th className="text-right" aria-sort={sort.k === "total" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}><button className="font-medium" onClick={() => flip("total")}>Paid {sort.k === "total" ? (sort.dir === 1 ? "↑" : "↓") : ""}</button></th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(page * PAGE, (page + 1) * PAGE).map((o) => {
                  const key = o.platform + o.id;
                  const toggle = () => setOpen(open === key ? null : key);
                  return (
                    <tr key={key} className="cursor-pointer border-t border-border hover:bg-border/30" tabIndex={0} aria-expanded={open === key} onClick={toggle}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}>
                      <td className="whitespace-nowrap py-2">{new Date(o.placedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td><span className="rounded px-2 py-0.5 text-xs text-white" style={{ background: PLATFORM_COLOR[o.platform] }}>{PLATFORM_LABEL[o.platform]}</span></td>
                      <td>{o.vendor}</td>
                      <td className="max-w-md text-muted">
                        {open === key
                          ? o.items.map((i) => <div key={i.rawName}>{i.qty}× {i.rawName} — {inr(i.amount ?? i.unitPrice * i.qty)} <span className="text-xs">{i.basis === "estimated" ? "est." : i.basis === "entered" ? "your price" : ""}</span></div>)
                          : <span className="line-clamp-1">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ") || "—"}</span>}
                      </td>
                      <td className="num text-right font-medium">
                        {inr(paidOf(o))}
                        {o.partial && <div className="text-xs font-normal text-muted" title="Share of this order that belongs to the selected categories">selected {(o.hi ?? 0) - (o.lo ?? 0) < 0.5 ? "" : "≈ "}{inr(o.total)}</div>}
                      </td>
                    </tr>
                  );
                })}
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
      )}
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
