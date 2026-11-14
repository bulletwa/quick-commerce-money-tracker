"use client";
import { FilterBar } from "../FilterBar";
import { AccuracyNote } from "../AccuracyNote";
import { ItemPrices } from "../ItemPrices";
import { Art3D } from "../art/images";
import { useData } from "./Data";

/** Filters + "showing N of M" + the accuracy note, shared by Spending and Orders. */
export function FilterStrip({ onChange }: { onChange?: () => void }) {
  const { all, orders, f, setF, clearFilters, categories, parts, hasFilter, period, conf, check, prices, setPrice } = useData();
  const total = all?.length ?? 0;
  return (
    <div className="space-y-3">
      <FilterBar f={f} set={(n) => { setF(n); onChange?.(); }} categories={categories} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Showing {orders.length.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} orders</span>
        <span className="text-muted">· {period}{parts.length ? " · " + parts.join(" · ") : ""}</span>
        {hasFilter && <button className="btn ml-auto" onClick={() => { clearFilters(); onChange?.(); }}>Clear filters</button>}
      </div>
      {f.categories.length > 0 && <AccuracyNote conf={conf} check={check}><ItemPrices orders={orders} prices={prices} onSet={setPrice} /></AccuracyNote>}
      {total > 0 && orders.length === 0 && (
        <div className="card flex flex-col items-center gap-2 py-8 text-center">
          <Art3D name="magnifying-glass-tilted-left" size={72} />
          <div className="font-medium">No orders match these filters</div>
          <p className="max-w-sm text-sm text-muted">Try removing a filter or widening the dates. Your saved orders are untouched.</p>
          <button className="btn" onClick={() => { clearFilters(); onChange?.(); }}>Clear filters</button>
        </div>
      )}
    </div>
  );
}
