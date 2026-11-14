# Zwinkit: the older local-server version (still works)

> The main project is the Chrome extension; see the root README. This page keeps the notes for the original localhost app.

> **Chrome extension version (Web Store ready):** `npm run pack:extension` builds `dist-extension/` and `zwinkit-extension.zip`.
> Load `dist-extension/` via `chrome://extensions` → Developer mode → Load unpacked to try it. Everything runs inside the extension: no server, data in `chrome.storage.local`.
> Source is in `extension-app/`; it reuses `src/lib` and `src/components`. Store listing text, permission justifications and the privacy policy are in `store/`.
> To move data from the local app: run `python3 scripts/export-local-backup.py`, then choose `.data/backup.json` with **Import backup** in the extension's dashboard.
> **Developers / new sessions: read [`docs/HOW-IT-WORKS.md`](docs/HOW-IT-WORKS.md) first** (architecture, how each platform is fetched, gotchas).
> The sections below describe the older local-server version (still works).
> **Developers / future sessions:** `docs/HOW-IT-WORKS.md` (architecture) and `docs/DATA-SOURCES.md` (every platform route, field names, tests, reference extensions, troubleshooting).


A local-only dashboard for your Zomato, Swiggy, Instamart, Blinkit and Zepto order history.
Everything stays on this computer: the app only listens on `127.0.0.1` and stores data in `.data/`.

## Open it

Double-click **Money Tracker.app** (in this folder; drag it to the Dock if you like).
It starts the server and opens the dashboard in Chrome (where the extension lives). There is no window to manage:
**close the dashboard tab and the server shuts itself down about 3 minutes later.** Nothing runs in the background otherwise.

From a terminal instead: `npm run app` (same behaviour, same Stop window).

The first launch after changes to the code rebuilds the app (~15 s). macOS may ask once to let the app access the
Desktop folder: choose Allow.

If you move this folder, re-create the app (it remembers the folder's path):

```bash
osacompile -o "Money Tracker.app" -e 'do shell script "nohup /bin/zsh \"'"$PWD"'/scripts/launcher.sh\" >/dev/null 2>&1 &"'
```

## Your data (`.data/`, never committed, never share it)

| File | What it is |
|---|---|
| `orders.db` | all fetched orders (SQLite) |
| `token` | secret that lets the dashboard page save fetched orders (other websites can't) |

To start from scratch, stop the app and delete `.data/orders.db*`.

## Getting orders

Load the Chrome extension in `extension/` once (its toolbar button also opens the dashboard) (`chrome://extensions` → Developer mode → Load unpacked), log in to the five sites in that Chrome, open the dashboard there and click **Fetch orders**. The extension reads each site's own order-history
route with your existing login, keeps only the order fields (no addresses, phone or payment details) and passes them to the
dashboard. It does nothing until you click. Fetching again is safe (orders are matched by real order id).

Limits: only delivered orders are kept. Zomato, Zepto, Instamart and Blinkit give item names but no per-item prices (Swiggy has them).
Swiggy's web history only reaches about a year back; instamart.in lists only a handful of recent orders. Older Blinkit orders
show no time of day, so noon is assumed. A Blinkit fetch takes a few minutes because it reads each order's items.

## Development

```bash
npm run dev      # development server (http://127.0.0.1:3000)
npm run build    # production build (the launcher does this when needed)
npm test         # unit tests
```
