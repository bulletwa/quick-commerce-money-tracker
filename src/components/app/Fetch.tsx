"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { PLATFORMS, PLATFORM_LABEL, type Platform } from "@/lib/types";
import { useData } from "./Data";

export type FetchLine = { text: string; error?: boolean };
const ERR: Record<string, string> = {
  "not-logged-in": "not logged in. Log in to it in this Chrome, then try again. Your saved orders are kept",
  unrecognised: "unexpected response (the site may have changed)",
};

/**
 * Reading orders takes a while, so it lives above the tabs: switching tab never cancels it or hides its progress.
 */
function useFetchState() {
  const { load } = useData();
  const [ext, setExt] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Record<string, FetchLine>>({});
  const [added, setAdded] = useState(0);
  const [finished, setFinished] = useState(0); // bumps each time a run ends, so screens can react
  const running = useRef(false);

  useEffect(() => { api.canFetch().then(setExt); }, []);
  const set = (p: string, s: FetchLine) => setLines((l) => ({ ...l, [p]: s }));

  const start = async (platforms: readonly Platform[] = PLATFORMS) => {
    if (running.current) return;
    running.current = true;
    setBusy(true); setLines({}); setAdded(0);
    try {
      await api.fetchOrders(platforms, (m) => {
        if (m.type === "done") return;
        const label = PLATFORM_LABEL[m.platform as Platform] ?? m.platform;
        if (m.type === "progress") set(m.platform, { text: `${label}: ${m.what === "prices" ? `reading item prices, ${m.done} of ${m.of} orders` : m.of ? `page ${m.done} of ${m.of}` : `${m.found} orders so far`}…` });
        else if (m.type === "error") set(m.platform, { text: `${label}: ${ERR[m.error] ?? m.error}`, error: true });
        else if (m.type === "imported") {
          setAdded((n) => n + m.added);
          set(m.platform, { text: `${label}: ${m.added} new, ${m.updated} already had, ${m.skipped} skipped (cancelled/failed)${m.priced ? `; exact item prices for ${m.priced} orders` : ""}${m.failed ? `; ${m.failed} orders’ prices could not be read (they stay estimated)` : ""}` });
        }
      });
    } finally { try { localStorage.setItem("mt-last-read", String(Date.now())); } catch { /* shown on Home only */ } running.current = false; setBusy(false); setFinished((n) => n + 1); await load(); }
  };
  return { ext, busy, lines, added, finished, start };
}

type FetchValue = ReturnType<typeof useFetchState>;
const Ctx = createContext<FetchValue | null>(null);
export function FetchProvider({ children }: { children: React.ReactNode }) {
  const v = useFetchState();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useFetch(): FetchValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFetch outside FetchProvider");
  return v;
}

/** Progress lines for the current/last read; renders nothing when there is nothing to say. */
export function FetchStatus() {
  const { lines } = useFetch();
  const rows = Object.entries(lines);
  if (!rows.length) return null;
  return <div className="space-y-1" role="status" aria-live="polite">{rows.map(([p, s]) => <div key={p} className={`text-sm ${s.error ? "text-bad" : "text-muted"}`}>{s.text}</div>)}</div>;
}

export function FetchButton({ label = "Read new orders", className = "btn btn-primary" }: { label?: string; className?: string }) {
  const { ext, busy, start } = useFetch();
  return (
    <div className="space-y-1">
      <button className={className} disabled={busy || ext === false} onClick={() => start()}>{busy ? "Reading orders…" : label}</button>
      {ext === false && <p className="text-sm text-bad">The Chrome extension was not found, so orders can&apos;t be read here.</p>}
    </div>
  );
}
