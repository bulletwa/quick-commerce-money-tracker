import { buildSummary } from "../src/lib/summary";
import { listGoals, listOrders } from "./store";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const COLOR = { ok: "#10b981", warn: "#f59e0b", over: "#ef4444" } as const;
const el = (tag: string, text = "", className = "") => Object.assign(document.createElement(tag), { textContent: text, className });

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
  if (!orders.length) { msg.textContent = "No orders yet. Open the dashboard, log in to your delivery apps in this browser, and click Fetch orders."; return; }
  const d = buildSummary(orders, goals);
  box.append(el("h4", `This month (${d.month})`));
  for (const [name, v] of [["Food", d.food], ["Groceries", d.grocery]] as const) {
    const row = el("div", "", "row");
    row.append(el("span", name), el("b", `${inr(v.spend)} · ${v.orders} orders`));
    box.append(row);
  }
  if (d.goals.length) box.append(el("h4", "Goals"));
  for (const g of d.goals) {
    const fmt = (n: number) => (g.metric === "spend" ? inr(n) : String(Math.round(n)));
    const row = el("div", "", "row");
    row.append(el("span", g.label), el("span", `${fmt(g.value)} / ${fmt(g.limit)}`));
    const bar = el("div", "", "bar"), fill = el("i");
    fill.style.width = Math.min(100, g.pct * 100) + "%"; fill.style.background = COLOR[g.state];
    bar.append(fill); box.append(row, bar);
  }
  for (const t of d.tips) box.append(el("div", "• " + t, "tip"));
})();
