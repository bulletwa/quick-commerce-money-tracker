"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type T = { id: number; text: string; undo?: () => void };
type Push = (text: string, undo?: () => void) => void;
const Ctx = createContext<Push>(() => {});
export const useToast = () => useContext(Ctx);

/** Brief, polite confirmations; an optional Undo replaces "Are you sure?" dialogs. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const n = useRef(0);
  const drop = (id: number) => setItems((l) => l.filter((t) => t.id !== id));
  const push = useCallback<Push>((text, undo) => {
    const id = ++n.current;
    setItems((l) => [...l.slice(-2), { id, text, undo }]);
    setTimeout(() => drop(id), undo ? 8000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast pop">
            <span>{t.text}</span>
            {t.undo && <button className="toast-undo" onClick={() => { t.undo?.(); drop(t.id); }}>Undo</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
