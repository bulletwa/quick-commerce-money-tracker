"use client";
import { useState } from "react";
import { LOOKS, applyLook, getLook, type Look } from "@/lib/look";
import { api } from "@/lib/api";
import { Backup } from "../Backup";
import { PHOTOS } from "../art/images";
import { useData } from "../app/Data";
import { FetchButton, FetchStatus } from "../app/Fetch";
import { Card } from "../app/ui";

export function Settings() {
  const { load } = useData();
  const [look, setLook] = useState<Look>(() => getLook());
  return (
    <div className="space-y-4">
      <h1 className="page-title">Settings</h1>
      <Card title="Your orders">
        <div className="space-y-3">
          <p className="text-sm text-muted">Reads your order history from the apps you&apos;re logged in to in this Chrome. Orders you already have are never duplicated.</p>
          <FetchButton label="Read new orders" />
          <FetchStatus />
        </div>
      </Card>
      <Card title="Setup"><div className="space-y-2"><p className="text-sm text-muted">Re-check which apps are logged in, or go through the first-time steps again.</p><a className="btn" href="#/setup">Replay setup</a></div></Card>
      <Card title="Appearance">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Appearance">
          {LOOKS.map((l) => (
            <button key={l.id} className="chip" data-on={look === l.id} aria-pressed={look === l.id} onClick={() => { setLook(l.id); applyLook(l.id); }}>
              {l.name} <span className="text-muted">· {l.blurb}</span>
            </button>
          ))}
        </div>
      </Card>
      {api.backup && <Card title="Backup & data"><Backup onChange={load} /></Card>}
      <Card title="About">
        <div className="space-y-2 text-sm text-muted">
          <p>Everything stays in this browser. Nothing is uploaded, and there are no accounts.</p>
          <p>3D illustrations: Microsoft Fluent UI Emoji (MIT). Photos on Unsplash by {Object.values(PHOTOS).map((p, i, a) => <span key={p.credit}><a className="underline" href={p.page} target="_blank" rel="noreferrer">{p.credit}</a>{i < a.length - 1 ? ", " : ""}</span>)}.</p>
        </div>
      </Card>
    </div>
  );
}
