# Data sources: how each platform's data is obtained, verified and recovered

Read this before touching any fetcher, and **before concluding that a platform "no longer works"**. It exists because on
14 Nov 2026 a wrong conclusion (see section 4) nearly cost a day. `HOW-IT-WORKS.md` is the architecture; this file is the
evidence base: exact routes, field names, who we learned them from, how they were tested, and what to do when they fail.

## 0. Principles (do not break these)

1. **Reuse the user's own logged-in session, inside the platform's own tab.** The request is same-origin, so cookies go
   with it. We never see or store passwords, OTPs or tokens, and the user types every login.
2. **Whitelist fields.** The detail responses contain phone numbers, addresses and coordinates. The page-side runners return
   only order id, date, vendor, item names/quantities/prices, bill rows and totals.
3. **No third-party server.** Everything stays on the machine (`chrome.storage.local` / `.data/`). One reference extension
   (section 5) uploads orders to a remote server; never adopt that.
4. **Undocumented routes.** They are the sites' own web calls. They can change without notice, and automated access may be
   against their terms. Design for graceful degradation: an order that cannot be priced stays *estimated*, never invented.
5. **Verify with data, not with how a page looks.** See section 4 for what happens otherwise.

## 1. Quick reference (verified 14 Nov 2026)

| Platform | List call | Detail call (item prices) | Needs | Verified on |
|---|---|---|---|---|
| Zomato | `GET /webroutes/user/orders?page=N` (106 pages, 10 orders each) | `GET /webroutes/order/details?hashId=<hashId>` | Zomato web session cookies | list: all 886; detail: 54 orders, Jun 2018 to Nov 2026 |
| Swiggy | `GET /dapi/order/all?order_id=<last id>` (cursor) | not needed: list has item prices | Swiggy web session | ~33 orders (web history is about 1 year) |
| Instamart | `GET https://instamart.in/api/instamart/orders?order_type=DASH&count=10&from_time=<ms>` | not tested | instamart.in session | 6 orders |
| Blinkit | `POST https://blinkit.com/v1/layout/order_history` (cursor `pagination.next_url`) | `POST https://blinkit.com/v1/layout/order_details/<orderId>?cart_id=<cartId>` | `localStorage.auth.accessToken`, `localStorage.authKey`, cookie `gr_1_deviceId` | list: 274 delivered; detail: 24 orders over all 28 pages |
| Zepto | `GET https://bff-gateway.zepto.com/api/v2/order/?page_number=N` | `POST https://bff-gateway.zepto.com/pfs-postorder/api/v1/get-page/ORDER_DETAILS` | Zepto web session cookies + `XSRF-TOKEN` | list: 93 orders; detail: 24 orders |

"Verified" means a real run on the owner's account, with the item prices reconciling to the platform's own totals (section 2).

## 2. Per-platform detail

### Zomato
- **List**: `entities.ORDER` is keyed by order id. Fields used: `orderId`, `hashId`, `orderDate` ("November 12, 2026 at 09:55 AM", IST),
  `totalCost` ("₹166.59"), `dishString` ("1 x 4 Pcs Samosa + 250 Grams Dhokla"), `deliveryDetails.deliveryLabel`, `resInfo.name`.
  Keep only `deliveryLabel === "Delivered"` (886 of 1,052 records; the rest are "Payment Incomplete" ~140, "Refund Completed" ~23, "Rejected" 5).
  `sections.SECTION_USER_ORDER_HISTORY.totalPages` is the page count; **a logged-out session answers HTTP 401** (see section 4).
- **Detail** (found by probing; see section 6): `details.order.items` is an object of *groups*, each an array of rows
  `{itemName, quantity, totalCost, displayCost, ...}`:
  `dish` (the food lines, `totalCost` = line total), `item_total`, `subtotal2`, `voucher_discount` (negative, e.g. -100),
  `salt_discount` ("Restaurant Promo", **positive**), `tax`, `charge` (delivery, packaging), `platform_charge`,
  `gold_subscription_charge`, `total_user` (grand total), `savings`.
  **Discount sign is inconsistent**: any group whose name contains "discount" counts by absolute value; any other negative row also counts.
  Getting this wrong made 9 of 40 sampled orders fail the check (fixed; 54 of 54 pass after).
  The response also carries `userPhone`, delivery address and coordinates: never read them.
- Reconcile rule (`pricedFromDetail`): Σ dish lines must equal `item_total` within ₹1, and implied fees (`total - Σ + discount`) must be
  between -₹1 and `Σ + ₹150`. Otherwise the order stays estimated.

### Blinkit
- **Auth is not cookies**: headers `access_token`, `auth_key` (from `localStorage.auth` / `localStorage.authKey`), `app_client: consumer_web`,
  `app_version: 1010101010`, `device_id` (cookie `gr_1_deviceId`). Blinkit sits behind Cloudflare; run the call from inside the Blinkit tab.
- **List**: dates have no year for recent orders (inferred by walking newest to oldest) and older orders have no time (noon IST assumed).
- **Detail**: `response.snippets[]`.
  - Item rows have `widget_type: "z_v3_image_text_snippet_type_30"`: `data.title.text` = name; `data.subtitle1.text` = "10 pcs x 2"
    (quantity is the trailing `x N`; "Pack of 6" is *not* a quantity); `data.subtitle3.text` = line price, e.g. "₹244" or
    markdown with a struck-through MRP first, `~~<regular-200|{grey-600|₹60}>~~ ₹46`, so **take the last ₹ number**.
  - Bill rows have `widget_type: "cart_bill_item"`: `data.left_header.text` / `data.right_header.text`: MRP, Product discount ("-₹14"),
    Item total, Convenience charge, Handling charge, Surge charge, Delivery charges, Tip amount, Bill total.
  - Line prices are already net of product discount, so Σ lines = "Item total". One order in 24 had no "Item total" row; Σ lines + fee rows = Bill total still held.
- Reconcile rule (`blinkitPriced`): Σ lines = "Item total" within ₹1, else Σ lines + fee rows + tip = "Bill total".

### Zepto
- **List**: needs headers `Appversion`/`App_version` (currently `17.2.2`; **the API answers HTTP 426 when it is older than the site's version**),
  `App_sub_platform: WEB`, `Auth_from_cookie: true`, `Auth_revamp_flow: v2`, `request_id`/`requestid`, `x-xsrf-token` (cookie `XSRF-TOKEN`),
  `x-timezone`, `request-signature`. We send `PLACEHOLDER_SIGNATURE` and it is accepted today; the reference extensions compute a real one
  (SHA-256 of `<csrfSecret>|<deviceId>|<method>|<requestId>|<xsrf>|<path>`); if Zepto starts enforcing it, switch to that or to capture-and-replay (section 5).
- **Detail**: body `{"orderId":"<uuid>","page_size":8,"isArchived":false,"enforce_platform_type":"DESKTOP"}`, same headers. The response is
  a page layout; find every array named `orderProducts` recursively (they sit under `pageLayout.widgets[].data.items[].orderProductsV2.sectionData[]`).
  Per product (money in **paise**): `storeProduct.product.name`, `quantityOrdered`, `quantityFulfilled`, `unitFinalSellingPrice`,
  `totalFinalSellingPrice` (after coupons and Z-Coins), `totalMrp`, `unitMrp`.
- Reconcile rule (`zeptoPriced`): Σ final lines must be at most the paid total (+₹1) and at least half of it; fees = total - Σ.
  On 24 orders, the unit counts matched the list's `itemQuantityCount` every time.
- **The order page only renders when reached by clicking through the app** (home, profile, orders). Loading `/order/<id>` directly gives a blank page
  in an automated browser. The API call itself works from any zepto.com tab.

### Swiggy and Instamart
- Swiggy food: the list already has item prices (`order_items[].name/quantity/total`), `item_total`, `order_discount`. Fees = total - item_total + discount.
- Instamart: only about 6 orders are reachable; no item prices from the list; detail route untested. Estimated, with manual prices as fallback.
- Swiggy also has an official developer MCP server (`mcp.swiggy.com/builders`): `get_order_details` returns item `finalPrice`, but its order list covers
  only the last 15 days, production use needs approval, and its terms forbid scraping beyond the API. Not used.

## 3. What an order becomes

Mappers in `src/lib/connectors/` turn raw runner output into `Order` objects. An order is `itemsPriced: true` **only if the reconcile rule above passes**.
`src/lib/analytics/amounts.ts` then gives every item an `amount` and `basis` (exact / entered / estimated) so the dashboard always says how sure it is.
The worker (`extension-app/background.js`: `DETAILS` map + `fetchPlatform`) reads details only for orders not already priced in storage, upserts after
every batch, and never replaces a priced order with a list-only copy. First run reads about 1,250 detail pages (Zomato 886); later runs read only new orders.

## 4. Incident: "Zomato does not work on the web any more" (14 Nov 2026). Read this.

Timeline (IST): 16:22 the extension fetched all 886 Zomato orders. About 21:30 the detail route worked and was tested on 54 orders.
About 22:20, after roughly 110 test calls plus a first full run of the new detail step, `/webroutes/user/orders` answered **401** in Chrome.
In that Chrome tab the Zomato home page showed only an "India's #1 food delivery app / Order on app" page with no login button, and `/login` redirected to it,
so it was concluded that Zomato had removed web login. **That conclusion was wrong.** Later the same evening the list call answered 200 again (106 pages), and the
built-in browser's `https://www.zomato.com/login` showed the full website with a **Login modal (phone + OTP, email, Google)**.

What went wrong and what to remember:
- The logged-out Zomato site can render different variants (the app-promo landing page vs the full site). **A page's look is not evidence of whether login exists.**
- The ground truth for session state is the API: `fetch('/webroutes/user/orders?page=1', {credentials:'same-origin'})` gives 401 when logged out and 200 with
  `sections.SECTION_USER_ORDER_HISTORY.totalPages` when logged in. Use that, from a normal zomato.com tab.
- Cause of the 401 is unproven. Candidates: ordinary session expiry, or Zomato revoking the session after a burst of calls (about 1,000 detail calls in a short time).
  Hence the worker spaces calls (4 at a time, 200-300 ms apart, 429 back-off) and a user can simply log in again.
- Recovery: open `https://www.zomato.com/login` in the same Chrome, log in with phone + OTP, then click Fetch orders. Saved orders are never deleted by a failed fetch.
- Before declaring any platform dead: (1) check the API status in a normal tab, (2) try its login URL in more than one browser, (3) re-read the reference extensions (section 5),
  which log in through the same URLs, (4) only then consider other sources (emailed receipts, which need the user's explicit consent to read).

## 5. Reference extensions (how the method was first learned, and how to re-check)

Installed in the owner's Chrome: `~/Library/Application Support/Google/Chrome/Default/Extensions/<id>/<version>/`. They are the user's own installs; read their files, never their stored data.

| Extension | Id / version | What it does for each platform | Notes |
|---|---|---|---|
| MunchMetrics (Swiggy & Zomato Spending Tracker) | `amdjphnlghpmdcdacbbccoehejdonlef` 3.1.0 | Zomato: `/webroutes/user/orders?page=N` from the popup/options page; login check = call it without a page and look for `totalPages`; else shows "Please Login" linking to `https://www.zomato.com/login`. Swiggy: `/dapi/order/all?order_id=`. Keeps raw orders in `chrome.storage.local`. | Origin of our Zomato method. List only; `dishString`, no item prices. |
| Total Damage (Zomato, Swiggy, Blinkit & Zepto Spend Tracker) | `ljnlfmlpifkdghlnkmeogmeliagjlmbc` 1.0.2 | Same Zomato and Swiggy routes. Blinkit/Zepto: a `world: MAIN` content script at `document_start` **hooks `fetch`/XHR on the orders page and captures the site's own request (URL, headers, body) and response, then replays it** with the same headers. On a logged-out result it opens the platform's login page in a popup window and waits. Spaces calls with back-off (429: 15 s). | Best fallback if signed headers break (Zepto `request-signature`, Blinkit headers). Lists only; no item prices. |
| Spending Calculator For Zepto & Blinkit | `dhemhbgajkjdaeocgmpoenpmohmamfkh` 1.3.1 | Zepto `/api/v2/order/?page_number=N` with a **real** `request-signature` and `Appversion 17.2.2` (comment: HTTP 426 if older). Blinkit `order_history` plus `order_details/<id>?cart_id=` (reads names and quantities only; `price: null`). | **Uploads orders and a user-typed name/gender to `qc.fooddy.in`.** Never copy that part. Its Blinkit detail read is what our first version mirrored; the prices were in `subtitle3.text` all along. |

Re-check commands (read-only):
```bash
cd ~/Library/Application\ Support/Google/Chrome/Default/Extensions
grep -rl "webroutes/user/orders" .          # which installed extension uses the Zomato route
grep -o "https\?://[A-Za-z0-9./_-]*" <id>/<ver>/background*.js | sort -u   # every host an extension talks to (spot uploads)
```
Chrome stores extension names behind `__MSG_...__` placeholders; search file contents rather than manifest names. None of the three reads Zomato per-dish prices.

## 6. How the item-price routes were found (repeat this method for a new route)

1. **Log the page's own calls.** In the platform tab, hook `fetch` and `XMLHttpRequest.prototype.open/send/setRequestHeader` *before* clicking through to an order, then read the log.
   Zepto uses XHR (axios): a `fetch` hook sees nothing. Capture URL, method, body and header **names** only; never log tokens.
2. **Direct navigation can be blank** (Zepto order pages); reach the page by clicking, keep the same window.
3. **`performance.getEntriesByType('resource')`** lists URLs but misses requests made by workers and is capped at 250 entries.
4. **Probe, sparingly.** For Zomato the list response had `hashId` and a "View Details" action with an empty URL; `/webroutes/order/details` returned an empty "Order Summary"
   shell until the right parameter name (`hashId`) was found; a handful of GETs, not a sweep.
5. **Inspect structure before values**: print key paths and numbers, not whole responses (they contain personal data).
6. **Validate before trusting**: run the *real* runner function on a spread of orders (recent and oldest, small and large) and check that item prices reconcile with the
   platform's own totals. Report counts only. Do the same inside the repo's tests with a fake `fetch` (`extension-app/runners.test.ts`, `worker.test.ts`).
7. Write the route, field names, reconcile rule and verification count into section 1 and 2 above.

## 7. When a platform stops returning data (decision tree)

1. Is the session valid? Call the list route from a normal tab of that site (see section 4). 401/403 or `not-logged-in`: ask the user to log in at the platform's login URL and retry.
2. 200 but no orders / different shape: the route changed. Re-run section 6 on the order page; compare with the reference extensions' current versions (section 5).
3. HTTP 426 (Zepto): update `Appversion`. HTTP 429: slow down; the runners already back off.
4. Detail call fails but the list works: orders stay estimated; the dashboard says so; nothing is lost.
5. All routes closed: other sources need the user's explicit consent (e.g. emailed receipts). Do not read mail without it.

## 8. Tooling gotchas seen while doing this

- The Chrome JS tool blocks output that looks like cookies or query strings: return counts, booleans and key names.
- A single browser call times out around 45 s: start long work with `window.__x = ...` and poll.
- Background tabs are throttled, so loops with timers run slowly; wait and poll.
- `executeScript` serialises the function: runners must be self-contained (no outer helpers).
- Hidden browser panes need the user to show them before they can sign in.
