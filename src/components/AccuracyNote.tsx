"use client";
import type { Confidence } from "@/lib/analytics/amounts";
import { inr } from "@/lib/format";

type Check = { categories: number; itemCost: number; paid: number; ok: boolean };

/** Says how sure the filtered numbers are, how they were worked out, and proves the category amounts add up. */
export function AccuracyNote({ conf, check, children }: { conf: Confidence; check: Check; children?: React.ReactNode }) {
  const exact = conf.high - conf.low < 1;
  return (
    <details className="card text-sm" open={!exact}>
      <summary className="cursor-pointer">
        {exact ? (
          <><b>{inr(conf.total)}</b> <span className="text-muted">for the selected items, exact (platform prices and prices you entered)</span></>
        ) : (
          <><b>≈ {inr(conf.total)}</b> <span className="text-muted">estimate for the selected items. It can&apos;t be below {inr(conf.low)} or above {inr(conf.high)}</span></>
        )}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted">
          {inr(conf.confirmed)} is confirmed (orders made only of these items, or items with a known price).
          {!exact && <> The rest is {conf.estimatedOrders} mixed order{conf.estimatedOrders === 1 ? "" : "s"} where the app doesn&apos;t know each item&apos;s price: what is left after known prices is shared equally per unit, which under-counts expensive items. Entering prices below narrows the range.</>}
        </p>
        {children}
        <p className="text-xs text-muted">
          Check: category amounts add up to {inr(check.categories)}, the combined item cost of all your orders ({inr(check.itemCost)}: item prices where the platform gives them, order totals where it doesn&apos;t) {check.ok ? "✓" : "✗ these differ, please report it"}. You paid {inr(check.paid)} in total (item cost plus fees, minus discounts).
        </p>
      </div>
    </details>
  );
}
