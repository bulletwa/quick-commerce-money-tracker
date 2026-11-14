"use client";
import { useEffect, useSyncExternalStore } from "react";

export const TABS = [
  { id: "home", label: "Home", icon: "house" },
  { id: "spending", label: "Spending", icon: "chart-pie" },
  { id: "orders", label: "Orders", icon: "receipt" },
  { id: "goals", label: "Goals", icon: "target" },
  { id: "settings", label: "Settings", icon: "gear" },
] as const;
export type TabId = (typeof TABS)[number]["id"] | "setup";

const parse = (): TabId => {
  const h = location.hash.replace(/^#\/?/, "");
  return (TABS.some((t) => t.id === h) || h === "setup" ? h : "home") as TabId;
};
const subscribe = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
/** The current tab lives in the URL hash, so Back works and a tab can be bookmarked. */
export function useRoute(): [TabId, (t: TabId) => void] {
  const tab = useSyncExternalStore(subscribe, parse, () => "home" as TabId);
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);
  return [tab, (t) => { location.hash = `/${t}`; }];
}
