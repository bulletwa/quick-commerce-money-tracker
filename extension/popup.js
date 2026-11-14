const URL_ = "http://127.0.0.1:3000/";
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const COLOR = { ok: "#10b981", warn: "#f59e0b", over: "#ef4444" };
const el = (tag, text, props = {}) => Object.assign(document.createElement(tag), { textContent: text, ...props });

const msg = document.getElementById("msg");
const HOST = "com.moneytracker.launcher";
const up = async () => { try { await fetch(URL_ + "api/token", { mode: "no-cors" }); return true; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const startViaHost = () => new Promise((resolve) =>
  chrome.runtime.sendNativeMessage(HOST, { cmd: "start" }, (r) => resolve(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : r)));

async function openTab() {
  const [t] = await chrome.tabs.query({ url: URL_ + "*" });
  if (t) { await chrome.tabs.update(t.id, { active: true }); await chrome.windows.update(t.windowId, { focused: true }); }
  else await chrome.tabs.create({ url: URL_ });
  window.close();
}

document.getElementById("open").onclick = async () => {
  const btn = document.getElementById("open");
  if (await up()) return openTab();
  btn.disabled = true; btn.textContent = "Starting…";
  msg.textContent = "Starting Zwinkit. The first start can take about 20 seconds.";
  const r = await startViaHost();
  if (!r || r.error || !r.ok) {
    btn.disabled = false; btn.textContent = "Open Zwinkit";
    msg.textContent = "One-time setup needed: in the project folder run  scripts/install-extension-host.sh  then reload this extension. Or start Money Tracker.app yourself.";
    return;
  }
  for (let i = 0; i < 90; i++) { if (await up()) return openTab(); await sleep(1000); }
  btn.disabled = false; btn.textContent = "Open Zwinkit";
  msg.textContent = "It didn't start in time. Check .data/server.log in the project folder.";
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
