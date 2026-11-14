"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "./app/Toast";

/** Export / import / erase. Only rendered in the extension build, where the browser holds the only copy of the data. */
export function Backup({ onChange }: { onChange: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [msg, setMsg] = useState("");
  const b = api.backup;
  if (!b) return null;

  const exportIt = async () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([await b.exportJson()], { type: "application/json" }));
    a.download = `money-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importIt = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = await b.importJson(await f.text());
      setMsg(`Imported ${r.orders} orders and ${r.goals} goals.`);
      onChange();
    } catch (e) { setMsg(e instanceof Error ? e.message : "That file could not be imported."); }
    if (file.current) file.current.value = "";
  };
  const clear = async () => {
    const snapshot = await b.exportJson(); // kept in memory so Undo can put everything back
    await b.clearAll();
    setMsg("");
    onChange();
    toast("All data deleted", async () => { await b.importJson(snapshot); onChange(); });
  };

  return (
    <div className="flex flex-col items-stretch gap-2 text-sm">
      <button className="btn" onClick={exportIt}>Export backup</button>
      <button className="btn" onClick={() => file.current?.click()}>Import backup</button>
      <button className="btn" onClick={clear}>Delete all data</button>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => importIt(e.target.files?.[0])} />
      {msg && <span className="text-muted">{msg}</span>}
    </div>
  );
}
