import { FetchOrders } from "@/components/FetchOrders";

export default function Setup() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Setup</h1>
      <div className="card space-y-2 text-sm">
        <p>
          A small Chrome extension reads your own Zomato and Swiggy order history using the login your browser already has, only when you click
          <b> Fetch orders</b>, and hands it to this local app. It is idle the rest of the time, and nothing leaves your computer.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>Open <code>chrome://extensions</code>, turn on <b>Developer mode</b>, click <b>Load unpacked</b>, choose the <code>extension</code> folder in this project. (After updating it, click its reload icon.)</li>
          <li>Log in to <a className="underline" href="https://www.zomato.com" target="_blank" rel="noreferrer">Zomato</a> and <a className="underline" href="https://www.swiggy.com" target="_blank" rel="noreferrer">Swiggy</a> in the same Chrome.</li>
          <li>Open this dashboard (<code>http://127.0.0.1:3000</code>) in that Chrome and click Fetch orders.</li>
        </ol>
        <FetchOrders />
      </div>
      <p className="text-xs text-muted">
        Zomato&apos;s list gives dishes and totals but no per-item prices. Swiggy&apos;s web history only reaches back about a year. Fetching again is safe: orders are matched by their real order id.
      </p>
    </div>
  );
}
