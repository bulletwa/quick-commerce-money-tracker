"use client";
import { useState } from "react";
import { LOOKS, applyLook, getLook, type Look } from "@/lib/look";
import { Mark } from "./art/illustrations";

/** Logotype, a note on where data lives, and the look switcher. */
export function AppHeader() {
  const [look, setLook] = useState<Look>(() => getLook());
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>Money Tracker</span>
        </div>
        <span className="text-xs text-muted">Stored only in this browser. Never uploaded.</span>
        <div className="ml-auto flex items-center gap-2" role="group" aria-label="Look">
          <span className="text-xs text-muted">Look</span>
          {LOOKS.map((l) => (
            <button key={l.id} className="chip" data-on={look === l.id} aria-pressed={look === l.id} title={`${l.name}: ${l.blurb}`}
              onClick={() => { setLook(l.id); applyLook(l.id); }}>{l.short}</button>
          ))}
        </div>
      </div>
    </header>
  );
}
