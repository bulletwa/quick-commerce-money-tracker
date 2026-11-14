"use client";
import { TABS, type TabId } from "./route";

/** Simple stroked icons drawn for this app (24px grid). */
const PATH: Record<string, React.ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" />,
  spending: <><path d="M12 3v9h9" /><path d="M20.5 15.5A9 9 0 1 1 8.5 3.5" /></>,
  orders: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />,
  goals: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  settings: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6" />,
};
export function TabIcon({ id }: { id: string }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{PATH[id]}</svg>;
}

/** Five labelled tabs: along the top on wide screens, along the bottom on phones. Only Goals ever carries a badge, and only when a goal is over its limit. */
export function TabBar({ tab, badge, go }: { tab: TabId; badge: number; go: (t: TabId) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <a key={t.id} href={`#/${t.id}`} className="tab" aria-current={tab === t.id ? "page" : undefined}
          onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(t.id); }}>
          <span className="tab-icon"><TabIcon id={t.id} />{t.id === "goals" && badge > 0 && <span className="tab-badge" aria-label={`${badge} over limit`}>{badge}</span>}</span>
          <span className="tab-label">{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
