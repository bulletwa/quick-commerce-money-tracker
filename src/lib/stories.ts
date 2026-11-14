import { SENSITIVE, byMonth, monthKey } from "./goals";
import { PLATFORM_LABEL, type Order } from "./types";

export interface Story { id: string; art: string; kicker: string; headline: string; detail: string }

const DAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const hour12 = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
const inrS = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/**
 * Short "about you" cards for Home. One idea per card, plain words, never a judgement.
 * Items in sensitive categories (tobacco, health) are left out of every card, so nothing private is surfaced.
 */
export function buildStories(orders: Order[], now = new Date()): Story[] {
  const out: Story[] = [];
  if (!orders.length) return out;

  // most-ordered dish / grocery, excluding sensitive categories
  const top = (type: "food" | "grocery") => {
    const m = new Map<string, { n: number; cat: string }>();
    for (const o of orders) if (o.type === type) for (const i of o.items) {
      if (SENSITIVE.includes(i.category)) continue;
      const r = m.get(i.name) ?? { n: 0, cat: i.category }; r.n += i.qty; m.set(i.name, r);
    }
    return [...m].sort((a, b) => b[1].n - a[1].n)[0];
  };
  const dish = top("food");
  if (dish && dish[1].n >= 2) out.push({ id: "dish", art: "fork-and-knife-with-plate", kicker: "Your go-to dish", headline: dish[0], detail: `Ordered ${dish[1].n} times` });
  const groc = top("grocery");
  if (groc && groc[1].n >= 2) out.push({ id: "grocery", art: "shopping-bags", kicker: "Your restock regular", headline: groc[0], detail: `${groc[1].n} bought so far` });

  // when you order
  if (orders.length >= 10) {
    const day = new Array(7).fill(0), hr = new Array(24).fill(0);
    for (const o of orders) { const d = new Date(o.placedAt); day[d.getDay()]++; hr[d.getHours()]++; }
    const di = day.indexOf(Math.max(...day)), hi = hr.indexOf(Math.max(...hr));
    out.push({ id: "when", art: "motor-scooter", kicker: "Your usual time", headline: `${DAYS[di]} around ${hour12(hi)}`, detail: `${day[di]} of your ${orders.length.toLocaleString("en-IN")} orders landed on ${DAYS[di].toLowerCase()}` });
  }

  // favourite app, by number of orders
  const byPlat = new Map<string, number>();
  for (const o of orders) byPlat.set(o.platform, (byPlat.get(o.platform) ?? 0) + 1);
  const plat = [...byPlat].sort((a, b) => b[1] - a[1])[0];
  if (plat && byPlat.size > 1) out.push({ id: "app", art: "trophy", kicker: "Your most-used app", headline: PLATFORM_LABEL[plat[0] as keyof typeof PLATFORM_LABEL], detail: `${Math.round((plat[1] / orders.length) * 100)}% of your orders` });

  // busiest full month
  const cur = monthKey(now);
  const months = [...byMonth(orders)].filter(([k]) => k < cur).map(([k, os]) => [k, os.reduce((t, o) => t + (o.fullTotal ?? o.total), 0)] as const);
  if (months.length >= 3) {
    const [k, v] = months.sort((a, b) => b[1] - a[1])[0];
    const label = new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
    out.push({ id: "month", art: "calendar", kicker: "Your busiest month", headline: label, detail: `${inrS(v)} across all your apps` });
  }
  return out;
}
