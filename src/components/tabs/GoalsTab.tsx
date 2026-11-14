"use client";
import { Art3D } from "../art/images";
import { Plan } from "../Plan";
import { Goals } from "../Goals";
import { useData } from "../app/Data";
import { Empty } from "../app/ui";
import type { TabId } from "../app/route";

export function GoalsTab({ go }: { go: (t: TabId) => void }) {
  const { all, goalOrders, parts, clearFilters } = useData();
  if (!all) return <p className="text-muted">Loading…</p>;
  if (!all.length) return <Empty art={<Art3D name="trophy" size={96} />} title="Goals start after your first read"><p>Once your orders are in, you can set monthly limits, and see how much to put aside at the start of each month.</p><button className="btn btn-primary" onClick={() => go("home")}>Go to Home</button></Empty>;
  const label = parts.length ? parts.join(" · ") : undefined;
  return (
    <div className="space-y-4">
      <h1 className="page-title">Goals</h1>
      <Plan orders={goalOrders} filterLabel={label} />
      <Goals orders={goalOrders} allOrders={all} filterLabel={label} onClear={clearFilters} />
    </div>
  );
}
