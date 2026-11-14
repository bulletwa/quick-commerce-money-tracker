"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { LoginState } from "@/lib/api-types";
import { PLATFORMS, PLATFORM_LABEL, type Platform } from "@/lib/types";
import { PLATFORM_COLOR } from "@/lib/format";
import { Art3D, Photo } from "../art/images";
import { useData } from "./Data";
import { FetchStatus, useFetch } from "./Fetch";
import type { TabId } from "./route";

const SITE: Record<Platform, string> = { zomato: "https://www.zomato.com/", swiggy: "https://www.swiggy.com/", instamart: "https://instamart.in/", blinkit: "https://blinkit.com/", zepto: "https://www.zepto.com/" };
const TIPS = ["Reading takes a few minutes the first time, since each order's exact prices are fetched too. You can look around meanwhile.", "Only new orders are read next time, so the next read takes seconds.", "Nothing leaves this browser. There is no account and no server.", "You can set a monthly limit in Goals once your orders are in."];

type Step = "welcome" | "connect" | "read";

/** Three short steps: say hello, connect the apps (we check who is logged in), read the orders. Skippable at every step. */
export function Setup({ go }: { go: (t: TabId) => void }) {
  const { all } = useData();
  const { busy, start, finished, added } = useFetch();
  const [step, setStep] = useState<Step>("welcome");
  const [login, setLogin] = useState<Partial<Record<Platform, LoginState | "checking">>>({});
  const [tip, setTip] = useState(0);
  const started = useRef(false);

  const check = () => {
    setLogin(Object.fromEntries(PLATFORMS.map((p) => [p, "checking"])));
    api.checkConnections(PLATFORMS, (p, s) => setLogin((l) => ({ ...l, [p]: s })));
  };
  const connect = () => { setStep("connect"); check(); };
  // coming back from logging in on another tab is the moment to re-check
  useEffect(() => {
    if (step !== "connect") return;
    const on = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [step]);
  useEffect(() => { if (step !== "read") return; const t = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 6000); return () => clearInterval(t); }, [step]);

  const read = () => {
    setStep("read");
    if (started.current) return;
    started.current = true;
    start(PLATFORMS.filter((p) => login[p] !== "out"));
  };
  const loggedIn = PLATFORMS.filter((p) => login[p] === "in").length;
  const done = step === "read" && !busy && finished > 0;

  return (
    <div className="mx-auto max-w-xl">
      <div className="card card-flush">
        {step === "welcome" && <>
          <Photo id="welcome" eager alt="" className="h-56 w-full object-cover" />
          <div className="space-y-4 p-6 text-center">
            <h1 className="page-title">See where your food money goes</h1>
            <p className="mx-auto max-w-sm text-muted">It reads the orders from the apps you&apos;re already logged in to. Everything stays in this browser.</p>
            <button className="btn btn-primary btn-lg" onClick={connect}>Let&apos;s start</button>
            <p className="text-xs text-muted">Takes about a minute to set up.</p>
          </div>
        </>}

        {step === "connect" && <div className="space-y-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Step 1 of 2</p>
            <h1 className="page-title">Connect your apps</h1>
            <p className="mt-1 text-muted">Log in to the ones you use, in this Chrome. We&apos;ll spot it automatically.</p>
          </div>
          <ul className="space-y-2">
            {PLATFORMS.map((p) => {
              const s = login[p];
              return (
                <li key={p} className="tile flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-bold text-white" style={{ background: PLATFORM_COLOR[p] }} aria-hidden="true">{PLATFORM_LABEL[p][0]}</span>
                  <span className="min-w-0 flex-1 font-semibold">{PLATFORM_LABEL[p]}</span>
                  {s === "checking" || !s ? <span className="text-sm text-muted" role="status">Checking…</span>
                    : s === "in" ? <span className="text-sm font-semibold" style={{ color: "var(--good)" }}>✓ Logged in</span>
                    : <a className="btn" href={SITE[p]} target="_blank" rel="noreferrer">{s === "out" ? "Log in" : "Open"}</a>}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary btn-lg" onClick={read}>{loggedIn ? `Read my orders (${loggedIn} ${loggedIn === 1 ? "app" : "apps"})` : "Read my orders"}</button>
            <button className="btn btn-quiet" onClick={check}>Check again</button>
          </div>
          <button className="text-sm text-muted underline" onClick={() => go("settings")}>Skip for now</button>
        </div>}

        {step === "read" && <div className="space-y-4 p-6 text-center">
          <Art3D name={done ? "party-popper" : "hourglass-not-done"} size={88} className={done ? "pop" : "bob"} />
          <h1 className="page-title">{done ? "You're all set" : "Reading your orders…"}</h1>
          {done
            ? <p className="text-muted">{added ? `${added.toLocaleString("en-IN")} new orders are in.` : (all?.length ?? 0) ? "Nothing new this time." : "No orders were found."}</p>
            : <p className="mx-auto max-w-sm text-sm text-muted" aria-live="off">{TIPS[tip]}</p>}
          <div className="text-left"><FetchStatus /></div>
          {done && <div className="flex justify-center gap-3">
            {(all?.length ?? 0) > 0 ? <button className="btn btn-primary btn-lg" onClick={() => go("home")}>Take me to Home</button> : <button className="btn btn-primary btn-lg" onClick={() => { started.current = false; connect(); }}>Back to apps</button>}
          </div>}
          {!done && <button className="text-sm text-muted underline" onClick={() => go("home")}>Look around meanwhile</button>}
        </div>}
      </div>
    </div>
  );
}
