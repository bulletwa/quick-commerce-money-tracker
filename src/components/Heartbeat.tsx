"use client";
import { useEffect } from "react";

export function Heartbeat() {
  useEffect(() => {
    const ping = () => fetch("/api/ping", { method: "POST" }).catch(() => {});
    ping();
    const t = setInterval(ping, 20000);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", ping); };
  }, []);
  return null;
}
