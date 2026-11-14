"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { goalProgress } from "@/lib/goals";
import { Mark } from "../art/illustrations";
import { DataProvider, useData } from "./Data";
import { FetchProvider } from "./Fetch";
import { ToastProvider } from "./Toast";
import { TabBar } from "./TabBar";
import { useRoute } from "./route";
import { Setup } from "./Setup";
import { Home } from "../tabs/Home";
import { Spending } from "../tabs/Spending";
import { OrdersTab } from "../tabs/OrdersTab";
import { GoalsTab } from "../tabs/GoalsTab";
import { Settings } from "../tabs/Settings";

function Shell() {
  const { all } = useData();
  const [tab, go] = useRoute();
  const [over, setOver] = useState(0);

  // the Goals tab shows a count only when a goal is over its limit (limits always use all orders)
  useEffect(() => {
    if (!all) return;
    api.listGoals().then((gs) => setOver(gs.filter((g) => goalProgress(g, all).state === "over").length)).catch(() => {});
  }, [all, tab]);

  return (
    <div className="shell">
      <a href="#main" className="skip" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <header className="topbar">
        <a href="#/home" className="brand" onClick={(e) => { e.preventDefault(); go("home"); }}><Mark /><span>Money Tracker</span></a>
        <TabBar tab={tab} badge={over} go={go} />
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6" tabIndex={-1}>
        {tab === "setup" ? <Setup go={go} /> : tab === "home" ? <Home go={go} /> : tab === "spending" ? <Spending go={go} /> : tab === "orders" ? <OrdersTab go={go} /> : tab === "goals" ? <GoalsTab go={go} /> : <Settings />}
      </main>
    </div>
  );
}

export default function AppShell() {
  return (
    <DataProvider><FetchProvider><ToastProvider><Shell /></ToastProvider></FetchProvider></DataProvider>
  );
}
