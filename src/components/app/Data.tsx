"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/types";
import { applyFilters, emptyFilters, filterParts, periodLabel, type Filters } from "@/lib/analytics";
import { confidence, reconcile, withAmounts, type Prices } from "@/lib/analytics/amounts";
import { api } from "@/lib/api";

/** One place that loads the saved orders and applies the filters, so every tab sees the same numbers. */
function useDataState() {
  const [all, setAll] = useState<Order[] | null>(null);
  const [prices, setPrices] = useState<Prices>({});
  const [f, setF] = useState<Filters>(emptyFilters);

  const load = useCallback(() => { api.listPrices().then(setPrices).catch(() => {}); return api.loadOrders().then(setAll); }, []);
  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const n = new Map<string, number>();
    for (const o of all ?? []) for (const i of o.items) n.set(i.category, (n.get(i.category) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
  }, [all]);
  const withAmt = useMemo(() => withAmounts(all ?? [], prices), [all, prices]);
  const orders = useMemo(() => applyFilters(withAmt, f), [withAmt, f]);
  /** goals are monthly, so they follow every filter except the date range */
  const goalOrders = useMemo(() => applyFilters(withAmt, { ...f, from: undefined, to: undefined }), [withAmt, f]);
  const conf = useMemo(() => confidence(orders), [orders]);
  const check = useMemo(() => reconcile(all ?? [], prices), [all, prices]);
  const approx = f.categories.length > 0 && conf.high - conf.low >= 1;
  const parts = useMemo(() => filterParts(f), [f]);
  const hasFilter = parts.length > 0 || !!f.from || !!f.to;
  const period = useMemo(() => periodLabel(f, orders), [f, orders]);
  const cardPeriod = parts.length ? `${period} · filtered${approx ? " · estimate" : ""}` : period;
  const setPrice = async (name: string, price: number | null) => setPrices(await api.setPrice(name, price));
  const clearFilters = () => setF(emptyFilters);
  return { all, withAmt, prices, setPrice, load, f, setF, clearFilters, categories, orders, goalOrders, conf, check, approx, parts, hasFilter, period, cardPeriod };
}

type DataValue = ReturnType<typeof useDataState>;
const Ctx = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const v = useDataState();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useData(): DataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}
