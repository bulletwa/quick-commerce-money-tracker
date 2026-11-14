// Runs only on the local dashboard (127.0.0.1:3000). Relays requests from the page to the extension and progress back.
window.addEventListener("message", (e) => {
  if (e.source !== window || e.origin !== location.origin || !e.data || e.data.source !== "mt-dashboard") return;
  if (e.data.type === "ping") return window.postMessage({ source: "mt-extension", type: "pong" }, location.origin);
  if (e.data.type === "badge") { try { chrome.runtime.sendMessage({ mt: "badge", over: Number(e.data.over) || 0, warn: Number(e.data.warn) || 0 }); } catch {} return; }
  if (e.data.type !== "fetch") return;
  const platforms = (e.data.platforms || []).filter((p) => ["zomato","swiggy","instamart","blinkit","zepto"].includes(p));
  const port = chrome.runtime.connect({ name: "fetch" });
  port.onMessage.addListener((m) => window.postMessage({ source: "mt-extension", ...m }, location.origin));
  port.onDisconnect.addListener(() => window.postMessage({ source: "mt-extension", type: "done" }, location.origin));
  port.postMessage({ platforms });
});
