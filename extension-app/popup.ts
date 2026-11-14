import { buildSummary } from "../src/lib/summary";
import { applyLook, getLook } from "../src/lib/look";
import { listGoals, listOrders } from "./store";

applyLook(getLook(), false);
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const COLOR = { ok: "var(--good)", warn: "var(--warn)", over: "var(--bad)" } as const;
const el = (tag: string, text = "", className = "") => Object.assign(document.createElement(tag), { textContent: text, className });

// the logo mark, drawn with the same tokens as the dashboard
const mark = document.getElementById("mark")!;
mark.innerHTML = '<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M9 7H23V25L20.5 23L18 25L16 23L14 25L11.5 23L9 25Z" fill="var(--accent-ink)"/><path d="M12 12H20M12 16H20M12 20H17" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/></svg>';

document.getElementById("open")!.onclick = async () => {
  const url = chrome.runtime.getURL("dashboard.html");
  const [t] = await chrome.tabs.query({ url });
  if (t?.id != null) { await chrome.tabs.update(t.id, { active: true }); if (t.windowId != null) await chrome.windows.update(t.windowId, { focused: true }); }
  else await chrome.tabs.create({ url });
  window.close();
};

(async () => {
  const [orders, goals] = await Promise.all([listOrders(), listGoals()]);
  const box = document.getElementById("sum")!, msg = document.getElementById("msg")!;
  if (!orders.length) { msg.textContent = "No orders yet. Open Zwinkit and follow the three quick steps to connect your apps."; return; }
  const d = buildSummary(orders, goals);
  box.append(el("h4", `This month (${d.month})`));
  for (const [name, v] of [["Food", d.food], ["Groceries", d.grocery]] as const) {
    const row = el("div", "", "row");
    row.append(el("span", name), el("b", `${inr(v.spend)} · ${v.orders} orders`, "num"));
    box.append(row);
  }
  const tot = el("div", "", "row total");
  tot.append(el("span", "Total so far"), el("b", inr(d.food.spend + d.grocery.spend), "num"));
  box.append(tot);
  if (d.goals.length) box.append(el("h4", "Goals"));
  for (const g of d.goals) {
    const row = el("div", "", "row");
    row.append(el("span", g.label), el("span", g.metric === "spend" ? `${inr(g.value)} / ${inr(g.limit)}` : `${Math.round(g.value)} / ${Math.round(g.limit)} orders`, "num val"));
    const bar = el("div", "", "bar"), fill = el("i");
    fill.style.transform = `scaleX(${Math.min(1, g.pct)})`; fill.style.background = COLOR[g.state];
    bar.append(fill); box.append(row, bar);
  }
  for (const t of d.tips) box.append(el("div", "• " + t, "tip"));
})();
