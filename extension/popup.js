const URL_ = "http://127.0.0.1:3000/";
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const COLOR = { ok: "#10b981", warn: "#f59e0b", over: "#ef4444" };
const el = (tag, text, props = {}) => Object.assign(document.createElement(tag), { textContent: text, ...props });

document.getElementById("open").onclick = async () => {
  try {
    await fetch(URL_ + "api/token", { mode: "no-cors" });
    const [t] = await chrome.tabs.query({ url: URL_ + "*" });
    if (t) { await chrome.tabs.update(t.id, { active: true }); await chrome.windows.update(t.windowId, { focused: true }); }
    else await chrome.tabs.create({ url: URL_ });
    window.close();
  } catch {
    document.getElementById("msg").textContent = "The dashboard isn't running. Open Money Tracker.app first, then click again.";
  }
};

// If the dashboard is running, show this month's numbers and goal progress (read-only; text is set with textContent).
(async () => {
  try {
    const r = await fetch(URL_ + "api/summary");
    if (!r.ok) return;
    const d = await r.json();
    const box = document.getElementById("sum");
    box.append(el("h4", `This month (${d.month})`));
    for (const [name, v] of [["Food", d.food], ["Groceries", d.grocery]]) {
      const row = el("div", "", { className: "row" });
      row.append(el("span", name), el("b", `${inr(v.spend)} · ${v.orders} orders`));
      box.append(row);
    }
    if (d.goals.length) box.append(el("h4", "Goals"));
    for (const g of d.goals) {
      const row = el("div", "", { className: "row" });
      const fmt = (n) => (g.metric === "spend" ? inr(n) : String(Math.round(n)));
      row.append(el("span", g.label), el("span", `${fmt(g.value)} / ${fmt(g.limit)}`));
      const bar = el("div", "", { className: "bar" });
      const fill = el("i", "");
      fill.style.width = Math.min(100, g.pct * 100) + "%"; fill.style.background = COLOR[g.state];
      bar.append(fill);
      box.append(row, bar);
    }
    for (const t of d.tips) box.append(el("div", "• " + t, { className: "tip" }));
    document.getElementById("msg").textContent = "Updates when you fetch orders in the dashboard.";
    chrome.runtime.sendMessage({ mt: "badge", over: d.over, warn: d.warn });
  } catch { /* dashboard not running: popup just shows the open button */ }
})();
