"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PLATFORMS, PLATFORM_LABEL, type Platform } from "@/lib/types";

type Status = { text: string; error?: boolean };
const ERR: Record<string, string> = {
  "not-logged-in": "not logged in. Log in to it in this Chrome, then try again",
  unrecognised: "unexpected response (the site may have changed)",
};

export function FetchOrders({ onDone }: { onDone?: () => void }) {
  const [ext, setExt] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Record<string, Status>>({});

  useEffect(() => { api.canFetch().then(setExt); }, []);
  const set = (p: string, s: Status) => setLines((l) => ({ ...l, [p]: s }));

  const start = async () => {
    setBusy(true);
    setLines({});
    try {
      await api.fetchOrders(PLATFORMS, (m) => {
        if (m.type === "done") return;
        const label = PLATFORM_LABEL[m.platform as Platform] ?? m.platform;
        if (m.type === "progress") set(m.platform, { text: `${label}: ${m.of ? `page ${m.done} of ${m.of}` : `${m.found} orders so far`}…` });
        else if (m.type === "error") set(m.platform, { text: `${label}: ${ERR[m.error] ?? m.error}`, error: true });
        else if (m.type === "imported") set(m.platform, { text: `${label}: ${m.added} new, ${m.updated} already had, ${m.skipped} skipped (cancelled/failed)` });
      });
    } finally { setBusy(false); onDone?.(); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy || ext === false} onClick={start}>{busy ? "Fetching…" : "Fetch orders"}</button>
        {ext === false && <span className="text-sm text-red-500">Extension not found. See <a className="underline" href="/connect">Setup</a>.</span>}
      </div>
      {Object.entries(lines).map(([p, s]) => <div key={p} className={`text-sm ${s.error ? "text-red-500" : "text-muted"}`}>{s.text}</div>)}
    </div>
  );
}
