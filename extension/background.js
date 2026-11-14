// Idle until the dashboard asks. Each platform is read inside its own site's tab (so your login applies), the page-side
// functions below keep only whitelisted fields (no addresses, phone or payment details), and the result goes to the dashboard.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SITES = { zomato: "https://www.zomato.com/", swiggy: "https://www.swiggy.com/", instamart: "https://instamart.in/", blinkit: "https://blinkit.com/", zepto: "https://www.zepto.com/" };

// ---------- page-side runners (serialised into the tab: each must be fully self-contained) ----------

async function runZomato() {
  const progress = (platform, done, of, found) => { try { chrome.runtime.sendMessage({ mt: "progress", platform, done, of, found }); } catch {} };
  const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
  const page = async (n) => {
    const r = await fetch(`/webroutes/user/orders?page=${n}`, { credentials: "same-origin" });
    if (!r.ok) return { error: r.status === 401 || r.status === 403 ? "not-logged-in" : `http-${r.status}` };
    let j; try { j = await r.json(); } catch { return { error: "not-logged-in" }; }
    const sec = j?.sections?.SECTION_USER_ORDER_HISTORY, ent = j?.entities?.ORDER;
    if (!sec || !ent) return { error: "unrecognised" };
    return { totalPages: Number(sec.totalPages) || 0, orders: Object.entries(ent).map(([id, o]) => ({
      orderId: String(o.orderId ?? id), orderDate: o.orderDate, totalCost: o.totalCost, label: o.deliveryDetails?.deliveryLabel,
      dishString: o.dishString, vendor: o.resInfo?.name, locality: o.resInfo?.locality?.localityName })) };
  };
  const first = await page(1);
  if (first.error) return first;
  const all = [...first.orders]; let done = 1;
  progress("zomato", done, first.totalPages, all.length);
  const rest = []; for (let n = 2; n <= first.totalPages; n++) rest.push(n);
  for (let i = 0; i < rest.length; i += 6) {
    const rs = await Promise.all(rest.slice(i, i + 6).map(page));
    for (const r of rs) { if (r.error) return r; all.push(...r.orders); }
    done += rs.length; progress("zomato", done, first.totalPages, all.length);
  }
  return { orders: all };
}

async function runSwiggy() {
  const progress = (platform, done, of, found) => { try { chrome.runtime.sendMessage({ mt: "progress", platform, done, of, found }); } catch {} };
  const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
  const all = []; let cursor = "", pages = 0;
  for (;;) {
    const r = await fetch(`/dapi/order/all?order_id=${encodeURIComponent(cursor)}`, { credentials: "same-origin" });
    if (!r.ok) return { error: r.status === 401 || r.status === 403 ? "not-logged-in" : `http-${r.status}` };
    let j; try { j = await r.json(); } catch { return { error: "not-logged-in" }; }
    if (!j?.data) return { error: /login|auth/i.test(j?.statusMessage || "") ? "not-logged-in" : "unrecognised" };
    const list = j.data.orders || [];
    if (!list.length) break;
    for (const o of list) all.push({ order_id: String(o.order_id), order_time: o.order_time, order_total: o.order_total, item_total: o.item_total,
      order_discount: o.order_discount, order_status: o.order_status, order_type: o.order_type, restaurant_name: o.restaurant_name,
      items: (o.order_items || []).map((i) => ({ name: i.name, quantity: i.quantity, total: i.total })) });
    const next = String(list[list.length - 1].order_id);
    if (next === cursor) break;
    cursor = next; progress("swiggy", ++pages, 0, all.length);
    await sleepP(100);
  }
  return { orders: all };
}

async function runInstamart() {
  const progress = (platform, done, of, found) => { try { chrome.runtime.sendMessage({ mt: "progress", platform, done, of, found }); } catch {} };
  const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
  const all = [], seen = new Set(); let from = Date.now(), pages = 0;
  for (;;) {
    const r = await fetch(`https://instamart.in/api/instamart/orders?order_type=DASH&count=10&from_time=${from}`, { credentials: "include" });
    if (!r.ok) return { error: r.status === 401 || r.status === 403 ? "not-logged-in" : `http-${r.status}` };
    let j; try { j = await r.json(); } catch { return { error: "unrecognised" }; }
    if (j.statusCode !== 0) return { error: "not-logged-in" };
    const list = j?.data?.orders || [];
    let added = 0;
    for (const o of list) {
      if (!o?.order_id || seen.has(o.order_id)) continue;
      seen.add(o.order_id); added++;
      const m = o.order_data_v2?.total || {};
      all.push({ order_id: String(o.order_id), created_at: o.created_at, status: o.history_status, units: m.units, nanos: m.nanos,
        items: (o.order_data_v2?.shipments || []).flatMap((s) => s.items || []).map((i) => ({ name: i.name, quantity: i.quantity })) });
    }
    const oldest = list[list.length - 1]?.created_at;
    progress("instamart", ++pages, 0, all.length);
    if (!added || !oldest || oldest >= from) break;
    from = oldest;
    await sleepP(150);
  }
  return { orders: all };
}

async function runZepto() {
  const progress = (platform, done, of, found) => { try { chrome.runtime.sendMessage({ mt: "progress", platform, done, of, found }); } catch {} };
  const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
  const ck = (n) => { const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; };
  const page = async (n) => {
    const id = crypto.randomUUID();
    const r = await fetch(`https://bff-gateway.zepto.com/api/v2/order/?page_number=${n}`, { credentials: "include", headers: {
      Accept: "application/json, text/plain, */*", Appversion: "17.2.2", App_version: "17.2.2", App_sub_platform: "WEB", Auth_from_cookie: "true",
      Auth_revamp_flow: "v2", "request-signature": "PLACEHOLDER_SIGNATURE", request_id: id, requestid: id, "x-xsrf-token": ck("XSRF-TOKEN"),
      "x-timezone": String(new Date().getTimezoneOffset()) } });
    if (!r.ok) return { error: r.status === 401 || r.status === 403 ? "not-logged-in" : `http-${r.status}` };
    let j; try { j = await r.json(); } catch { return { error: "unrecognised" }; }
    if (!Array.isArray(j.orders)) return { error: "unrecognised" };
    return { end: !!j.endOfList || !j.orders.length, orders: j.orders.map((o) => ({ id: String(o.id), status: o.status, placedTime: o.placedTime,
      grandTotalAmount: o.grandTotalAmount, totalRefundAmount: o.totalRefundAmount, items: (o.productsNamesAndCounts || []).map((p) => ({ name: p.name, count: p.count })) })) };
  };
  const all = [], seen = new Set(); let n = 1;
  for (;;) {
    const rs = await Promise.all([n, n + 1, n + 2, n + 3].map(page));
    for (const r of rs) {
      if (r.error) return r;
      for (const o of r.orders) if (!seen.has(o.id)) { seen.add(o.id); all.push(o); }
      if (r.end) { progress("zepto", 0, 0, all.length); return { orders: all }; }
    }
    n += 4; progress("zepto", n - 1, 0, all.length);
  }
}

// Blinkit is read in short steps (the list, then item details in batches) so no single page-side run is long.
async function runBlinkit() {
  const progress = (platform, done, of, found) => { try { chrome.runtime.sendMessage({ mt: "progress", platform, done, of, found }); } catch {} };
  const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
  let auth = null; try { auth = JSON.parse(localStorage.getItem("auth") || "null"); } catch {}
  const authKey = localStorage.getItem("authKey");
  if (!auth?.accessToken || !authKey) return { error: "not-logged-in" };
  const dev = (document.cookie.match(/gr_1_deviceId=([^;]*)/) || [])[1];
  const H = { access_token: auth.accessToken, app_client: "consumer_web", app_version: "1010101010", auth_key: authKey, device_id: dev };
  const call = async (url, init) => {
    for (let a = 1; a <= 4; a++) {
      let r;
      try { r = await fetch(url, { ...init, headers: { ...H, ...(init.headers || {}) }, signal: AbortSignal.timeout(20000) }); }
      catch { await sleepP(1000 * a); continue; }
      if (r.ok) { try { return await r.json(); } catch { return { error: "unrecognised" }; } }
      if (r.status === 401 || r.status === 403) return { error: "not-logged-in" };
      await sleepP((r.status === 429 ? 5000 : 800) * a);
    }
    return { error: "http-failed" };
  };
  const DATE = /\d{1,2}\s+[A-Za-z]{3,9},?\s*(?:\d{4},?\s*)?\d{1,2}:\d{2}\s*[ap]m|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}/i;
  const strings = (n, out, d = 0) => { if (d > 8 || n == null) return out; if (typeof n === "string") out.push(n); else if (typeof n === "object") for (const v of Object.values(n)) strings(v, out, d + 1); return out; };
  const findCards = (n, out, d = 0) => { if (!n || typeof n !== "object" || d > 8) return out; if (Array.isArray(n)) { n.forEach((c) => findCards(c, out, d + 1)); return out; }
    if (n.tracking?.common_attributes?.order_id || /^order_\d+_\d+/.test(String(n.data?.identity?.id || ""))) { out.push(n); return out; }
    Object.values(n).forEach((c) => findCards(c, out, d + 1)); return out; };
  const orders = [], seen = new Set(); let url = "https://blinkit.com/v1/layout/order_history", pages = 0;
  while (url && pages < 200) {
    const j = await call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (j.error) { if (!orders.length) return j; break; }
    const resp = j.response || j; let added = 0;
    for (const c of findCards(resp, [])) {
      const common = c.tracking?.common_attributes || {}, idm = String(c.data?.identity?.id || "").match(/^order_(\d+)_(\d+)/);
      const id = String(common.order_id || idm?.[1] || ""); if (!id || seen.has(id)) continue;
      seen.add(id); added++;
      const txt = strings(c.data, []); const blob = JSON.stringify(c.data || {});
      orders.push({ orderId: id, cartId: idm?.[2] || (blob.match(/cart_id=(\d+)/) || [])[1], status: String(common.order_status || ""),
        amount: (blob.match(/₹\s*[\d,]+(?:\.\d+)?/) || [""])[0], dateText: (txt.find((t) => DATE.test(t)) || "").match(DATE)?.[0] || "", items: [] });
    }
    const next = resp.pagination?.next_url; pages++;
    progress("blinkit", pages, 0, orders.length);
    if (!next || !added) break;
    url = new URL(next, "https://blinkit.com").href;
    await sleepP(100);
  }
  return { orders };
}
async function runBlinkitDetails(batch) {
  const progress = (platform, done, of, found) => { try { chrome.runtime.sendMessage({ mt: "progress", platform, done, of, found }); } catch {} };
  const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
  let auth = null; try { auth = JSON.parse(localStorage.getItem("auth") || "null"); } catch {}
  const authKey = localStorage.getItem("authKey");
  if (!auth?.accessToken || !authKey) return { error: "not-logged-in" };
  const dev = (document.cookie.match(/gr_1_deviceId=([^;]*)/) || [])[1];
  const H = { access_token: auth.accessToken, app_client: "consumer_web", app_version: "1010101010", auth_key: authKey, device_id: dev };
  const call = async (url, init) => {
    for (let a = 1; a <= 4; a++) {
      let r;
      try { r = await fetch(url, { ...init, headers: { ...H, ...(init.headers || {}) }, signal: AbortSignal.timeout(20000) }); }
      catch { await sleepP(1000 * a); continue; }
      if (r.ok) { try { return await r.json(); } catch { return { error: "unrecognised" }; } }
      if (r.status === 401 || r.status === 403) return { error: "not-logged-in" };
      await sleepP((r.status === 429 ? 5000 : 800) * a);
    }
    return { error: "http-failed" };
  };
  const out = [];
  await Promise.all(batch.map(async (o) => {
    const d = await call(`https://blinkit.com/v1/layout/order_details/${o.orderId}?cart_id=${o.cartId}`, { method: "POST", headers: {} });
    const items = [];
    for (const s of d?.response?.snippets || []) {
      if (s?.widget_type !== "z_v3_image_text_snippet_type_30") continue;
      const name = s.data?.title?.text, q = (s.data?.subtitle1?.text || "").match(/(\d+)\s*$/);
      if (name) items.push({ name, qty: q ? parseInt(q[1], 10) : 1 });
    }
    out.push({ orderId: o.orderId, items });
  }));
  return { items: out };
}
const RUNNERS = { zomato: runZomato, swiggy: runSwiggy, instamart: runInstamart, blinkit: runBlinkit, zepto: runZepto };

// ---------- worker side ----------
let sendNow = () => {};
// Badge: red count = goals over their limit, amber = nearing it. Set only when the dashboard or popup reports it.
function setBadge(over, warn) {
  const n = Number(over) || 0, w = Number(warn) || 0;
  chrome.action.setBadgeText({ text: n ? String(n) : w ? String(w) : "" });
  chrome.action.setBadgeBackgroundColor({ color: n ? "#ef4444" : "#f59e0b" });
}
chrome.runtime.onMessage.addListener((m) => { if (m?.mt === "badge") setBadge(m.over, m.warn); });
chrome.runtime.onMessage.addListener((m) => { if (m?.mt === "progress") sendNow({ type: "progress", platform: m.platform, done: m.done, of: m.of, found: m.found }); });

async function getTab(platform) {
  const found = await chrome.tabs.query({ url: SITES[platform] + "*" });
  if (found.length) return { id: found[0].id, opened: false };
  const t = await chrome.tabs.create({ url: SITES[platform], active: false });
  await new Promise((resolve) => {
    const l = (id, info) => { if (id === t.id && info.status === "complete") { chrome.tabs.onUpdated.removeListener(l); resolve(); } };
    chrome.tabs.onUpdated.addListener(l); setTimeout(resolve, 20000);
  });
  await sleep(1500); // let the site's own scripts settle (tokens in storage)
  return { id: t.id, opened: true };
}

// Item names per delivered order, 8 at a time; the order list is already safe on the dashboard side only after this ends,
// so a failed batch just leaves those orders without items.
async function blinkitDetails(tab, orders, send) {
  const byId = new Map(orders.map((o) => [o.orderId, o]));
  for (let pass = 0; pass < 3; pass++) {
    const todo = orders.filter((o) => /^DELIVERED$/i.test(o.status) && o.cartId && !o.items.length);
    if (!todo.length) break;
    for (let i = 0; i < todo.length; i += 4) {
      try {
        const r = (await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: runBlinkitDetails, args: [todo.slice(i, i + 4)] }))[0]?.result;
        for (const d of r?.items || []) if (byId.has(d.orderId)) byId.get(d.orderId).items = d.items;
      } catch { await sleep(2000); }
      send({ type: "progress", platform: "blinkit", done: Math.min(i + 4, todo.length), of: todo.length, found: orders.length });
      await sleep(400);
    }
    await sleep(3000);
  }
}

async function fetchPlatform(platform, send) {
  const tab = await getTab(platform);
  try {
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { r = (await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: RUNNERS[platform] }))[0]?.result; if (r || attempt === 2) break; await sleep(3000); }
      catch (e) { // the site reloaded its tab mid-run: wait and run again
        if (attempt === 2) throw e;
        await sleep(2500);
        try { await chrome.tabs.get(tab.id); } catch { Object.assign(tab, await getTab(platform)); }
      }
    }
    if (!r || r.error) return send({ type: "error", platform, error: r?.error || "no-result" });
    if (platform === "blinkit") await blinkitDetails(tab, r.orders, send);
    send({ type: "orders", platform, orders: r.orders.map(({ cartId, ...o }) => o) });
  } catch (e) {
    send({ type: "error", platform, error: String(e?.message || e) });
  } finally {
    if (tab.opened) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async ({ platforms }) => {
    const send = (m) => { try { port.postMessage(m); } catch {} };
    sendNow = send;
    await Promise.all(platforms.map((p) => fetchPlatform(p, send)));
    send({ type: "done" });
    try { port.disconnect(); } catch {}
  });
});
