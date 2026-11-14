"use client";
import { useEffect, useRef, useState } from "react";
import { PLATFORMS, PLATFORM_LABEL, type Platform } from "@/lib/types";

type Status = { text: string; error?: boolean };
const ERR: Record<string, string> = {
  "not-logged-in": "not logged in — log in to it in this Chrome, then try again",
  unrecognised: "unexpected response (the site may have changed)",
};

export function FetchOrders({ onDone }: { onDone?: () => void }) {
  const [ext, setExt] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Record<string, Status>>({});
  const token = useRef("");

  useEffect(() => {
    fetch("/api/token").then((r) => r.json()).then((j) => (token.current = j.token));
    const on = (e: MessageEvent) => { if (e.source === window && e.data?.source === "mt-extension" && e.data.type === "pong") setExt(true); };
    window.addEventListener("message", on);
    window.postMessage({ source: "mt-dashboard", type: "ping" }, location.origin);
    const t = setTimeout(() => setExt((v) => v ?? false), 1500);
    return () => { window.removeEventListener("message", on); clearTimeout(t); };
  }, []);

  const set = (p: string, s: Status) => setLines((l) => ({ ...l, [p]: s }));

  const start = () => {
    setBusy(true);
    setLines({});
    const imports: Promise<void>[] = [];
    const on = (e: MessageEvent) => {
      const m = e.data;
      if (e.source !== window || m?.source !== "mt-extension") return;
      const label = PLATFORM_LABEL[m.platform as Platform] ?? m.platform;
      if (m.type === "progress") set(m.platform, { text: `${label}: ${m.of ? `page ${m.done} of ${m.of}` : `${m.found} orders so far`}…` });
      else if (m.type === "error") set(m.platform, { text: `${label}: ${ERR[m.error] ?? m.error}`, error: true });
      else if (m.type === "orders") {
        imports.push(
          fetch("/api/fetch-import", { method: "POST", headers: { "content-type": "application/json", "x-tracker-token": token.current }, body: JSON.stringify({ platform: m.platform, orders: m.orders }) })
            .then((r) => r.json())
            .then((j) => set(m.platform, j.error ? { text: `${label}: ${j.error}`, error: true } : { text: `${label}: ${j.added} new, ${j.updated} already had, ${j.skipped} skipped (cancelled/failed)` })),
        );
      } else if (m.type === "done") {
        window.removeEventListener("message", on);
        Promise.all(imports).then(() => { setBusy(false); onDone?.(); });
      }
    };
    window.addEventListener("message", on);
    window.postMessage({ source: "mt-dashboard", type: "fetch", platforms: PLATFORMS }, location.origin);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy || ext === false} onClick={start}>{busy ? "Fetching…" : "Fetch orders"}</button>
        {ext === false && <span className="text-sm text-red-500">Extension not found — see <a className="underline" href="/connect">Setup</a>.</span>}
      </div>
      {Object.entries(lines).map(([p, s]) => <div key={p} className={`text-sm ${s.error ? "text-red-500" : "text-muted"}`}>{s.text}</div>)}
    </div>
  );
}
