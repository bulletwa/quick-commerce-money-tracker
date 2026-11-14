# How Money Tracker works (handover notes)

Read this first in a new session. It explains what the app is, how orders are fetched, where data lives, and the gotchas
learned the hard way. `README.md` is the user-facing quick start; `AGENTS.md` warns that this Next.js (16.x) differs from
older versions, so check `node_modules/next/dist/docs/` before touching Next APIs.

## 1. What it is

A personal dashboard of food-delivery and quick-commerce spending: **Zomato, Swiggy, Instamart, Blinkit, Zepto**
(spend by platform/category/item, insights, budgets, goals, per-item drill-down with frequency and time of day).

Hard constraints from the user (keep honouring them):
- **Local only.** Data never leaves the machine. Server binds `127.0.0.1` only.
- **Nothing runs in the background.** No cron/launch agents/daemons. The server stops itself when the dashboard tab is closed.
- **The user types every login and OTP.** We never handle passwords; we reuse the sessions already logged in to Chrome.
- Only whitelisted order fields are read (no addresses, phone numbers or payment details).

## 2. Two shipping forms (same dashboard code)

| | Local-server version | Chrome-extension version |
|---|---|---|
| Where | `src/` (Next.js app) + `extension/` (fetcher) | `extension-app/` (bundles `src/components` and `src/lib`) |
| Data store | SQLite `.data/orders.db` via `src/lib/db.ts` | `chrome.storage.local` via `extension-app/store.ts` |
| Dashboard talks to | `src/lib/api.ts` (HTTP to `/api/*`) | `extension-app/api.ts` (swapped in by esbuild alias `@/lib/api`) |
| Build | `npm run build` / `npm run app` | `npm run build:extension` (`pack:extension` adds the zip) into `dist-extension/` |
| Store text | | `store/STORE_LISTING.md`, `store/PRIVACY.md` |

The dashboard UI talks only to the `Api` interface in `src/lib/api-types.ts`; that is what makes both forms share one UI.
Move data from the local app to the extension with `python3 scripts/export-local-backup.py` then **Import backup**.
The rest of this doc describes the local-server version in detail; the extension version differs only in storage and in
having its own copy of the fetch runners (`extension-app/background.js`, tested by `extension-app/runners.test.ts`,
`worker.test.ts`). **If you change a fetch runner, change it in both `extension/background.js` and `extension-app/background.js`.**

## 3. Running it (local-server version)

- Double-click `Money Tracker.app` (an `osacompile` wrapper) or `npm run app`. Both call `scripts/launcher.sh`.
- `launcher.sh`: rebuilds only if the source changed, starts production `next start -H 127.0.0.1 -p 3000`, opens **Chrome**
  (the extension lives there, not Safari), then watches `.data/last-ping`. The dashboard page (`src/components/Heartbeat.tsx`,
  mounted in `src/app/layout.tsx`) hits `/api/ping` every ~20 s, which touches that file. If it is older than `IDLE_LIMIT`
  (180 s) the launcher kills the server. So: close the tab, and ~3 minutes later nothing is running.
- If the folder moves, re-create the app with the `osacompile` command in the README (it stores the folder path).
- Optional: the extension popup can start the app via Chrome **native messaging** (`scripts/native-host.js`, installed once by
  `scripts/install-extension-host.sh`; host name `com.moneytracker.launcher`; understands only `start` and `status`).
  The extension has a fixed ID because `extension/manifest.json` carries a `key`.
- Tests: `npm test` (Vitest). Lint: `npm run lint` (0 errors; unused-variable warnings in the extension are known).

## 4. How orders are fetched (the core idea)

The extension calls each platform's **own order-history web route from inside the user's already-logged-in tab**. The
request is same-origin (or CORS-allowed), so the session cookies go with it; no passwords, no scraping of rendered HTML,
no third-party server. The method was learned by reading the installed "MunchMetrics" extension (MIT) and later the
"Spending Calculator For Zepto & Blinkit" extension.

Flow, triggered only by the **Fetch orders** button (`src/components/FetchOrders.tsx`):

1. Dashboard page `window.postMessage({source:"mt-dashboard", type:"fetch", platforms})`.
2. `extension/bridge.js` (content script, **only** on `http://127.0.0.1:3000/*`) checks origin and relays it over a
   `chrome.runtime.connect` port to the service worker. It also answers `ping` with `pong` so the page can detect the extension.
3. `extension/background.js` runs the requested platforms in parallel (`Promise.all`). For each: find the user's open tab on that
   site or open an inactive one (waits for load + 1.5 s), then `chrome.scripting.executeScript` a **page-side runner** that does the
   paged fetching and returns only whitelisted fields. Up to 3 attempts per platform. Progress/orders/errors/done are posted back
   as messages and re-emitted to the page by the bridge.
4. The dashboard posts the raw orders to `POST /api/fetch-import` (`src/app/api/fetch-import/route.ts`). It checks the local
   token (`.data/token`, fetched from `/api/token`) and that the request is local, dispatches to the right mapper by platform,
   then `upsertOrders` saves them. Response: `{added, updated, skipped, received}`.
5. Order ids are the platforms' real ids, so re-fetching is idempotent (updates, no duplicates).

### Page-side runner rules
`executeScript` serialises the function, so **each runner must be fully self-contained**: define `progress` / `sleep` helpers
*inside* the function. Referencing module-level helpers makes every platform return "no-result" (this happened).
Long work must not block one call for minutes; Blinkit is split into batched worker-driven steps with timeouts.

### Per-platform routes and quirks

| Platform | Route | Notes |
|---|---|---|
| Zomato | `GET /webroutes/user/orders?page=N` | ~106 pages, 6 in parallel. `entities.ORDER` keyed by real id with `orderDate` (full date with year), `totalCost`, `dishString`, `resInfo`. **Keep only `deliveryDetails.deliveryLabel === "Delivered"`.** Skipped: "Payment Incomplete" (never charged, ~140), "Refund Completed" (~23; 8 of those were delivered then refunded), "Rejected". Counting payment-failed orders inflates spend (another extension does; ours is correct). No item prices. When the web login is gone the error says so plainly. |
| Swiggy | `GET /dapi/order/all?order_id=<last id>` | Cursor = last order id until an empty page. Web history only reaches ~1 year (~33 orders). **Only platform with real item prices.** Fees = total − itemTotal + discount. |
| Instamart | `GET https://instamart.in/api/instamart/orders?order_type=DASH&count=10&from_time=<ms>` | Only a handful of recent orders exist. |
| Blinkit | `POST https://blinkit.com/v1/layout/order_history` (cursor `pagination.next_url`) then `POST /v1/layout/order_details/<id>?cart_id=<cart>` per order for items | Headers: `access_token`, `app_client: consumer_web`, `app_version: 1010101010`, `auth_key`, `device_id`. Dates have **no year** (inferred walking newest→oldest) and older orders have **no time** (noon IST assumed). Details fetched in batches of 4, 400 ms gap, 3 passes. Takes a few minutes. Exact item prices read from order details (commit ef37798). |
| Zepto | `GET https://bff-gateway.zepto.com/api/v2/order/?page_number=N` | 4 pages in parallel; uses the `PLACEHOLDER_SIGNATURE` trick, `Appversion 17.2.2` and `x-xsrf-token` from the cookie. |

The Blinkit date regex (date with optional year, optional time) is in `extension/background.js`; Blinkit mapping is
`mapBlinkit(raws, now)` in `src/lib/connectors/grocery-web.ts`.

## 5. From raw to stored order

Mappers (pure functions, unit-tested in `src/lib/connectors/web.test.ts`):
`zomato-web.ts` (`mapZomato`, `parseZomatoDate`, `parseDishString`, `parseRupees`), `swiggy-web.ts` (`mapSwiggy`),
`grocery-web.ts` (`mapZepto`, `mapInstamart`, `mapBlinkit`). They produce `Order` (`src/lib/types.ts`): platform, id,
`placedAt`, type, total, fees, items (`rawName`, qty, price, category), optional `allUnits` and `itemsPriced`.

- Names and categories come from `src/lib/enrich/categorize.ts` (`normalizeName` strips stray `|`; `categorize` is rule-based).
  They are **re-applied on read** (`listOrders`), so improving the rules fixes already-imported orders. A tobacco
  misclassification was fixed this way (commit d3664d5).
- `upsertOrders(orders, source)` in `src/lib/db.ts`: inserts or updates by `(platform, id)`, records `first_seen_at`, and **never
  wipes saved items when a re-fetch comes back with none** (a failed detail read must not destroy data). Returns `{added, updated}`.
- Dates are stored UTC; a day can differ from IST near midnight.

### Spend is partly an estimate
Only Swiggy (and Blinkit where order details give prices) has real per-item prices. Otherwise `lineSpend(o, i)` in
`src/lib/analytics/index.ts` **shares the order total across item units** and the UI flags it "≈". Users can also set manual
prices (`/api/prices`, `src/lib/analytics/amounts.ts`). `categorySpend`, `topItems`, `itemDetail` all go through `lineSpend`.

## 6. Dashboard code map

- `src/app/page.tsx`, `src/components/Dashboard.tsx`: main view; `TopList` rows are clickable and show "N× · ≈ ₹X".
- `src/components/FilterBar.tsx` (the category filter drives every chart), `ItemDrill.tsx` (drawer: frequency, time of day,
  per-platform data, via `itemDetail`), `Goals.tsx` + `src/lib/goals.ts` (budgets/goals, neutral wording), `ItemPrices.tsx`,
  `AccuracyNote.tsx`, `Backup.tsx`, `FetchOrders.tsx`.
- `src/lib/analytics/index.ts`: filters, `kpis`, `insights`, `topItems`, `itemDetail`, `categorySpend`.
- `src/app/connect/page.tsx`: setup page (load extension, log in to the five sites in this Chrome, click Fetch).
- API routes (`src/app/api/`): `orders`, `fetch-import`, `token`, `ping`, `goals`, `prices`, `summary`. All gated by
  `hostOk` / token checks in `src/lib/token.ts`.
- `src/lib/sample.ts` is **test fixtures only**; the app has no seed/sample data path any more.

## 7. Data and files

`.data/` (git-ignored, personal, never share): `orders.db` (+ WAL), `token`, `last-ping`, `server.log`.
Start from scratch: stop the app, delete `.data/orders.db*`. Server stdout goes to `.data/server.log`.

## 8. Known limits and open items

- Instamart web shows only ~6 orders; Swiggy web ~1 year; Zomato/Zepto/Instamart list responses carry no item prices.
- Older Blinkit orders have an assumed noon time; Blinkit years are inferred.
- Unverified: the idle auto-shutdown has not been observed end to end (the user's open tab kept pinging).
- A comparison with another extension ("Total Damage" / "Data check") showed Zomato matches once payment-failed orders are
  excluded; an unexplained ₹32 Instamart difference remains. Whether the 8 delivered-then-refunded Zomato orders should count as spend
  is undecided.
- Offered but not built: a "Data check" panel on our dashboard (per platform: imported / counted / left out and why).
- Leftover from earlier work, unused: Android emulator + SDK (~8 GB: `~/.android/avd`, `/opt/homebrew/share/android-commandlinetools`).
- These routes are undocumented and can change; when a platform returns nothing, first check the user is logged in at that
  site in this Chrome, then inspect the route in DevTools.

## 9. Gotchas that cost time before

- Page-side runners must be self-contained (see §4).
- A single long `executeScript`/browser call times out: run long work asynchronously and poll.
- After deleting routes, clear stale types with `rm -rf .next` before rebuilding.
- The Next prerender rejects event-handler props passed into Client Components from a Server page.
- The Chrome JS tool blocks output that looks like cookies/query strings; return counts and key names only.
- After changing `extension/`, the user must reload it in `chrome://extensions` before refetching.
