"use client";
import AppShell from "./app/AppShell";

/** The whole app: a tabbed shell (Home, Spending, Orders, Goals, Settings). Shared by the Chrome extension and the local Next build. */
export default function Dashboard() { return <AppShell />; }
