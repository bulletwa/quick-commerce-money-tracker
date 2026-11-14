import { mapSwiggy } from "../src/lib/connectors/swiggy-web";
import { mapZomato } from "../src/lib/connectors/zomato-web";
import { mapBlinkit, mapInstamart, mapZepto } from "../src/lib/connectors/grocery-web";
import { buildSummary } from "../src/lib/summary";
import { listGoals, listOrders, pricedIds, upsertOrders } from "./store";

// Idle until you click "Fetch orders" in the dashboard. Each platform is read inside its own site's tab (so your login applies), the page-side
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
      orderId: String(o.orderId ?? id), hashId: o.hashId, orderDate: o.orderDate, totalCost: o.totalCost, label: o.deliveryDetails?.deliveryLabel,
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
    let r;
    for (let a = 1; a <= 4; a++) { // a 503/429 is usually momentary (the site is busy): wait and ask again before giving up
      r = await fetch(`/dapi/order/all?order_id=${encodeURIComponent(cursor)}`, { credentials: "same-origin" }).catch(() => null);
      if (r && (r.ok || (r.status < 500 && r.status !== 429))) break;
      await sleepP(1500 * a);
    }
    if (!r) return { error: "http-network" };
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
      // Item prices are in the same response: order_data.orders[].order_jobs[].metadata is a JSON string whose bill.billedItems[] has each
      // line's total (bill.totalCost) and the job's item cost (bill.totalItemCost). Only names, quantities and those amounts are kept.
      const lines = []; let itemCost = 0, haveCost = false;
      for (const job of (o.order_data?.orders || []).flatMap((x) => x.order_jobs || [])) {
        let md = job.metadata; if (typeof md === "string") { try { md = JSON.parse(md); } catch { md = null; } }
        const bill = md?.bill; if (!bill) continue;
        for (const b of bill.billedItems || []) lines.push({ name: String(b.item?.name || ""), qty: Number(b.bill?.quantity ?? b.item?.quantity) || 1, total: Number(b.bill?.totalCost) });
        if (Number.isFinite(Number(bill.totalItemCost))) { itemCost += Number(bill.totalItemCost); haveCost = true; }
      }
      all.push({ order_id: String(o.order_id), created_at: o.created_at, status: o.history_status, units: m.units, nanos: m.nanos,
        items: (o.order_data_v2?.shipments || []).flatMap((s) => s.items || []).map((i) => ({ name: i.name, quantity: i.quantity })),
        lines, itemCost: haveCost ? itemCost : null });
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
    let r;
    for (let a = 1; a <= 4; a++) {
      const id = crypto.randomUUID();
      r = await fetch(`https://bff-gateway.zepto.com/api/v2/order/?page_number=${n}`, { credentials: "include", headers: {
        Accept: "application/json, text/plain, */*", Appversion: "17.2.2", App_version: "17.2.2", App_sub_platform: "WEB", Auth_from_cookie: "true",
        Auth_revamp_flow: "v2", "request-signature": "PLACEHOLDER_SIGNATURE", request_id: id, requestid: id, "x-xsrf-token": ck("XSRF-TOKEN"),
        "x-timezone": String(new Date().getTimezoneOffset()) } }).catch(() => null);
      if (r && r.ok) break;
      if (r && (r.status === 403 || (r.status === 401 && a >= 3) || (r.status < 500 && r.status !== 429 && r.status !== 401))) break; // a real refusal
      await sleepP(1200 * a);
    }
    if (!r) return { error: "http-network" };
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
    const items = [], bill = {};
    // line price = the last "₹n" in the text (a struck-through MRP may come first); bill rows are label/value pairs, "-₹14" is a discount
    const rupees = (t) => { const m = [...String(t || "").matchAll(/₹\s*([\d,]+(?:\.\d+)?)/g)]; return m.length ? parseFloat(m[m.length - 1][1].replace(/,/g, "")) : null; };
    for (const s of d?.response?.snippets || []) {
      if (s?.widget_type === "cart_bill_item") {
        const label = s.data?.left_header?.text, t = String(s.data?.right_header?.text || ""), v = rupees(t);
        if (label && v != null) bill[label] = t.trim().startsWith("-") ? -v : v;
        continue;
      }
      if (s?.widget_type !== "z_v3_image_text_snippet_type_30") continue;
      const name = s.data?.title?.text, q = (s.data?.subtitle1?.text || "").match(/\bx\s*(\d+)\s*$/i), line = rupees(s.data?.subtitle3?.text);
      if (name && (line != null || s.data?.subtitle1?.text)) items.push({ name, qty: q ? parseInt(q[1], 10) : 1, line }); // a "1 item unavailable" row has no price or quantity
    }
    out.push({ orderId: o.orderId, items, bill });
  }));
  return { details: out };
}
// Zomato: per-dish prices and the bill, by the order's hashId (from the list). Only dish lines and money rows are kept; the response also
// carries phone, address and coordinates, which are never read.
async function runZomatoDetails(batch) {
  const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  await Promise.all(batch.map(async (b, k) => {
    await sleepP(k * 200);
    for (let a = 1; a <= 3; a++) {
      try {
        const r = await fetch(`/webroutes/order/details?hashId=${encodeURIComponent(b.hashId)}`, { credentials: "same-origin" });
        if (r.status === 401 || r.status === 403) { out.push({ orderId: b.orderId, error: "not-logged-in" }); return; }
        if (!r.ok) { await sleepP((r.status === 429 ? 4000 : 700) * a); continue; }
        const it = (await r.json())?.details?.order?.items || {};
        const dishes = (it.dish || []).map((x) => ({ name: String(x.itemName || ""), qty: Number(x.quantity) || 1, total: Number(x.totalCost) }));
        const itemTotal = Number((it.item_total || [])[0]?.totalCost), grand = Number((it.total_user || [])[0]?.totalCost);
        // discounts: every group named "*_discount" (coupons come negative, restaurant promos positive, so by absolute value) plus any other negative row
        let discount = 0;
        for (const [g, rows] of Object.entries(it)) {
          if (/^(item_total|dish|subtotal\d*|total_user|savings)$/.test(g)) continue;
          for (const x of Array.isArray(rows) ? rows : []) { const v = Number(x.totalCost); if (/discount/i.test(g)) discount += Math.abs(v) || 0; else if (v < 0) discount += -v; }
        }
        out.push({ orderId: b.orderId, detail: { dishes, itemTotal: Number.isFinite(itemTotal) ? itemTotal : null, discount, grandTotal: Number.isFinite(grand) ? grand : null } });
        return;
      } catch { await sleepP(700 * a); }
    }
    out.push({ orderId: b.orderId, error: "failed" });
  }));
  return { details: out };
}

// Zepto: per-product final line totals (paise) from the order-detail page call. Same headers as the list call.
async function runZeptoDetails(batch) {
  const sleepP = (ms) => new Promise((r) => setTimeout(r, ms));
  const ck = (n) => { const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; };
  const products = (n, out, d = 0) => { if (n == null || typeof n !== "object" || d > 12) return out; if (!Array.isArray(n) && Array.isArray(n.orderProducts)) out.push(...n.orderProducts); for (const v of Object.values(n)) products(v, out, d + 1); return out; };
  const out = [];
  await Promise.all(batch.map(async (b, k) => {
    await sleepP(k * 250);
    for (let a = 1; a <= 3; a++) {
      try {
        const id = crypto.randomUUID();
        const r = await fetch("https://bff-gateway.zepto.com/pfs-postorder/api/v1/get-page/ORDER_DETAILS", { method: "POST", credentials: "include", headers: {
          Accept: "application/json, text/plain, */*", "Content-Type": "application/json", Appversion: "17.2.2", App_version: "17.2.2", App_sub_platform: "WEB", Auth_from_cookie: "true",
          Auth_revamp_flow: "v2", "request-signature": "PLACEHOLDER_SIGNATURE", request_id: id, requestid: id, "x-xsrf-token": ck("XSRF-TOKEN"),
          "x-timezone": String(new Date().getTimezoneOffset()) }, body: JSON.stringify({ orderId: b.orderId, page_size: 8, isArchived: false, enforce_platform_type: "DESKTOP" }) });
        if (r.status === 401 || r.status === 403) { out.push({ orderId: b.orderId, error: "not-logged-in" }); return; }
        if (!r.ok) { await sleepP((r.status === 429 ? 4000 : 700) * a); continue; }
        const list = products(await r.json(), [], 0);
        out.push({ orderId: b.orderId, detail: list.map((p) => ({ name: String(p.storeProduct?.product?.name || ""), qty: Number(p.quantityFulfilled ?? p.quantityOrdered) || 1, total: Number(p.totalFinalSellingPrice) })) });
        return;
      } catch { await sleepP(700 * a); }
    }
    out.push({ orderId: b.orderId, error: "failed" });
  }));
  return { details: out };
}
// One cheap request per site to see whether the user is logged in (used by the guided setup). Fully self-contained like the runners.
// Returns { state: "in" | "out" | "unknown" }: "unknown" means the site was busy or changed, so the setup lets the user carry on anyway.
async function checkLogin(platform) {
  const verdict = (r) => (r.status === 401 || r.status === 403 ? "out" : r.ok ? "in" : "unknown");
  try {
    if (platform === "blinkit") {
      let auth = null; try { auth = JSON.parse(localStorage.getItem("auth") || "null"); } catch {}
      return { state: auth?.accessToken && localStorage.getItem("authKey") ? "in" : "out" };
    }
    if (platform === "zomato") {
      const r = await fetch("/webroutes/user/orders?page=1", { credentials: "same-origin" });
      if (!r.ok) return { state: verdict(r) };
      try { const j = await r.json(); return { state: j?.sections?.SECTION_USER_ORDER_HISTORY ? "in" : "out" }; } catch { return { state: "out" }; }
    }
    if (platform === "swiggy") {
      const r = await fetch("/dapi/order/all?order_id=", { credentials: "same-origin" });
      if (!r.ok) return { state: verdict(r) };
      try { const j = await r.json(); return { state: j?.data ? "in" : /login|auth/i.test(j?.statusMessage || "") ? "out" : "unknown" }; } catch { return { state: "out" }; }
    }
    if (platform === "instamart") {
      const r = await fetch(`https://instamart.in/api/instamart/orders?order_type=DASH&count=1&from_time=${Date.now()}`, { credentials: "include" });
      if (!r.ok) return { state: verdict(r) };
      try { const j = await r.json(); return { state: j.statusCode === 0 ? "in" : "out" }; } catch { return { state: "unknown" }; }
    }
    if (platform === "zepto") {
      const ck = (n) => { const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; };
      const id = crypto.randomUUID();
      const r = await fetch("https://bff-gateway.zepto.com/api/v2/order/?page_number=1", { credentials: "include", headers: {
        Accept: "application/json, text/plain, */*", Appversion: "17.2.2", App_version: "17.2.2", App_sub_platform: "WEB", Auth_from_cookie: "true",
        Auth_revamp_flow: "v2", "request-signature": "PLACEHOLDER_SIGNATURE", request_id: id, requestid: id, "x-xsrf-token": ck("XSRF-TOKEN"),
        "x-timezone": String(new Date().getTimezoneOffset()) } });
      return { state: verdict(r) };
    }
  } catch { /* offline or blocked */ }
  return { state: "unknown" };
}

const RUNNERS = { zomato: runZomato, swiggy: runSwiggy, instamart: runInstamart, blinkit: runBlinkit, zepto: runZepto };

// ---------- worker side ----------
const MAPPERS = { zomato: mapZomato, swiggy: mapSwiggy, instamart: mapInstamart, blinkit: mapBlinkit, zepto: mapZepto };
let sendNow = () => {};
chrome.runtime.onMessage.addListener((m) => { if (m?.mt === "progress") sendNow({ type: "progress", platform: m.platform, done: m.done, of: m.of, found: m.found }); });

// Toolbar badge: red = goals over their limit, otherwise amber = goals close to it. Refreshed whenever stored data changes.
async function refreshBadge() {
  try {
    const d = buildSummary(await listOrders(), await listGoals());
    chrome.action.setBadgeText({ text: d.over ? String(d.over) : d.warn ? String(d.warn) : "" });
    chrome.action.setBadgeBackgroundColor({ color: d.over ? "#ef4444" : "#f59e0b" });
  } catch { /* badge is cosmetic */ }
}
chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && (c.orders || c.goals)) refreshBadge(); });
chrome.runtime.onStartup.addListener(refreshBadge);
chrome.runtime.onInstalled.addListener(refreshBadge);

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

// Per-order detail calls: item prices and the bill. Each runs inside the site's tab (so the login applies), a few orders at a time.
// Only orders that are not already priced in storage are fetched, so after the first run a fetch only reads the new orders.
const DETAILS = {
  blinkit: { run: runBlinkitDetails, size: 4, id: (o) => o.orderId, eligible: (o) => /^DELIVERED$/i.test(o.status) && o.cartId, arg: (o) => ({ orderId: o.orderId, cartId: o.cartId }),
    apply: (o, d) => { if (d.items?.length) { o.items = d.items; o.bill = d.bill; } } },
  zepto: { run: runZeptoDetails, size: 4, id: (o) => o.id, eligible: (o) => /^DELIVERED$/i.test(o.status), arg: (o) => ({ orderId: o.id }),
    apply: (o, d) => { if (d.detail) o.detail = d.detail; } },
  zomato: { run: runZomatoDetails, size: 4, id: (o) => o.orderId, eligible: (o) => o.label === "Delivered" && o.hashId, arg: (o) => ({ orderId: o.orderId, hashId: o.hashId }),
    apply: (o, d) => { if (d.detail) o.detail = d.detail; } },
};

async function runInTab(tab, func, args) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { const r = (await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args }))[0]?.result; if (r || attempt === 2) return r; await sleep(2000); }
    catch (e) { // the site reloaded its tab mid-run: wait and run again
      if (attempt === 2) throw e;
      await sleep(2500);
      try { await chrome.tabs.get(tab.id); } catch { Object.assign(tab, await getTab(tab.platform)); }
    }
  }
}

async function fetchPlatform(platform, send) {
  const tab = await getTab(platform);
  tab.platform = platform;
  try {
    const r = await runInTab(tab, RUNNERS[platform]);
    if (!r || r.error) return send({ type: "error", platform, error: r?.error || "no-result" });
    const list = r.orders;
    const priced = await pricedIds(platform);
    // never replace an order that already has exact prices with a list-only copy
    const mapNow = (raws) => { const m = MAPPERS[platform](raws); const orders = m.orders.filter((o) => !(priced.has(o.id) && !o.itemsPriced)); return { orders, skipped: m.skipped, kept: m.orders.length - orders.length }; };
    if (list.length && !mapNow(list).orders.length && mapNow(list).skipped === list.length && !list.some((o) => o && typeof o === "object")) return send({ type: "error", platform, error: "unrecognised" });
    // 1. the list, so new orders show up straight away even if the detail calls fail
    const first = mapNow(list);
    const res = await upsertOrders(first.orders);
    // 2. exact item prices for orders that do not have them yet
    const D = DETAILS[platform];
    const todo = D ? list.filter((o) => D.eligible(o) && !priced.has(String(D.id(o)))) : [];
    let done = 0, failed = 0, loginError = null;
    const byId = new Map(todo.map((o) => [String(D.id(o)), o]));
    for (let pass = 0; pass < 2 && todo.length && !loginError; pass++) {
      const queue = pass === 0 ? todo : todo.filter((o) => !o.__ok);
      if (pass === 1) { if (!queue.length) break; await sleep(3000); }
      for (let i = 0; i < queue.length && !loginError; i += D.size) {
        const batch = queue.slice(i, i + D.size);
        let out = [];
        try { out = (await runInTab(tab, D.run, [batch.map(D.arg)]))?.details || []; } catch { await sleep(2000); }
        for (const d of out) {
          const o = byId.get(String(d.orderId));
          if (!o) continue;
          if (d.error === "not-logged-in") { loginError = d.error; break; }
          if (!d.error) { D.apply(o, d); o.__ok = true; }
        }
        const got = batch.filter((o) => o.__ok);
        if (got.length) await upsertOrders(mapNow(got).orders);
        if (pass === 0) { done += batch.length; send({ type: "progress", platform, what: "prices", done: Math.min(done, todo.length), of: todo.length, found: list.length }); }
        await sleep(300);
      }
    }
    failed = todo.filter((o) => !o.__ok).length;
    if (loginError) send({ type: "error", platform, error: loginError });
    else send({ type: "imported", platform, added: res.added, updated: res.updated + first.kept, skipped: first.skipped, priced: todo.length - failed, failed }); // "already had" includes orders kept because they already have exact prices
  } catch (e) {
    send({ type: "error", platform, error: String(e?.message || e) });
  } finally {
    if (tab.opened) chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function checkConnections(platforms, send) {
  await Promise.all(platforms.map(async (platform) => {
    let tab = null;
    try {
      tab = await getTab(platform); tab.platform = platform;
      const r = await runInTab(tab, checkLogin, [platform]);
      send({ type: "login", platform, state: r?.state || "unknown" });
    } catch { send({ type: "login", platform, state: "unknown" }); }
    finally { if (tab?.opened) chrome.tabs.remove(tab.id).catch(() => {}); }
  }));
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "check" && port.sender?.id === chrome.runtime.id) {
    port.onMessage.addListener(async ({ platforms }) => {
      const send = (m) => { try { port.postMessage(m); } catch {} };
      await checkConnections((Array.isArray(platforms) ? platforms : []).filter((p) => p in SITES), send);
      send({ type: "done" });
      try { port.disconnect(); } catch {}
    });
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "fetch" || port.sender?.id !== chrome.runtime.id) return;
  port.onMessage.addListener(async ({ platforms }) => {
    const send = (m) => { try { port.postMessage(m); } catch {} };
    sendNow = send;
    const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(() => {}), 20000); // a long Blinkit fetch must not let the worker sleep
    const wanted = (Array.isArray(platforms) ? platforms : []).filter((p) => p in SITES);
    try { await Promise.all(wanted.map((p) => fetchPlatform(p, send))); }
    finally { clearInterval(keepAlive); }
    send({ type: "done" });
    try { port.disconnect(); } catch {}
  });
});

// exposed for tests (the bundler drops it from the service worker)
export { fetchPlatform, checkConnections };
