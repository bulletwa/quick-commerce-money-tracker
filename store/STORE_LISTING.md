# Chrome Web Store listing: ready to paste

## Name
Quick Commerce Money Tracker

## Summary (max 132 characters)
See what you spend on food delivery and quick-commerce groceries. Set budgets and goals. Your data never leaves your browser.

## Category
Productivity (alternative: Shopping)

## Detailed description
Quick Commerce Money Tracker turns your order history from Zomato, Swiggy, Instamart, Blinkit and Zepto into a clear picture of where your money goes, and helps you spend less.

WHAT YOU GET
• A friendly guided setup: connect your apps, read your orders, done in a few minutes
• A Home screen with this month at a glance ("On track: ₹13,480 left") and short cards about your habits, like your go-to dish
• Most-ordered dishes, groceries and restaurants, spend by category, by platform and by month
• When you order: a day-by-hour view
• Light and dark, plus a calm dark look
• Budgets and goals for food and groceries: monthly spend, order counts, small orders, late-night orders. Starter goals are based on your last 2 months, so they are realistic
• Live tips that update as your orders change, such as items you reorder again and again, or a month running above your usual
• Toolbar badge that shows how many goals are over or close to their limit
• Export and import your data as a file; delete everything in one click

PRIVATE BY DESIGN
• Nothing is uploaded. Your orders, budgets and goals are stored only in your browser
• No accounts, no analytics, no ads, no servers
• Reads only order details (items, prices, totals, times). Never your address, phone number, payment details or passwords

HOW IT WORKS
1. Log in to your delivery apps in Chrome as usual
2. Open the extension, click "Open Money Tracker" and follow the three setup steps (it spots which apps you are logged in to)
3. Explore Home, Spending, Orders and Goals, then add a goal

Not affiliated with Zomato, Swiggy, Instamart, Blinkit or Zepto.

## Single purpose
Show the user their own food-delivery and quick-commerce spending, and help them track budgets and goals against it.

## Permission justifications (Privacy practices tab)
- **Host permissions (zomato.com, swiggy.com, instamart.in, blinkit.com, zepto.com, bff-gateway.zepto.com):** needed to read the user's own order history from those sites, only when the user clicks "Read my orders" / "Read new orders", or during the setup's "which apps are logged in" check (one small request per site). These are the extension's single purpose; no other sites are accessed.
- **scripting:** injects the order-history reader into those sites so the requests (order list and each order's detail page data: items, prices, bill) run with the user's existing session. The reader keeps only whitelisted order fields and never reads names, phone numbers or addresses.
- **storage:** stores orders, budgets and goals locally on the user's device.
- **Remote code:** No. All code is packaged in the extension.

## Data usage disclosure (tick these)
- Collects: **Personally identifiable information: No. Financial and payment information: No (no card or bank details). Web history: No. Website content: Yes (the user's own order details from the five sites, stored locally only).**
- Certify: not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used for creditworthiness or lending.
- Privacy policy URL: host `store/PRIVACY.md` publicly (for example GitHub Pages or a public gist) and paste the URL.

## Assets you still need to provide
(The extension icon is already the new bill mark. Make screenshots with `src/lib/sample.ts` data, not real orders; use the default Plate look (a dark one is nice for variety). Sizes: 1280x800 screenshots, 440x280 small tile, optional 1400x560 marquee.)
- Screenshots: at least 1 (1280x800 or 640x400). Use Home, Spending and the setup screen with sample data (blur real vendor names if you prefer).
- Optional: small promo tile 440x280. Icon 128x128 is already in the package.

## Before you submit: risks to know about
1. **Site terms.** The extension reads each site's own order-history endpoints (the same ones their web pages call) with the user's session. These endpoints are not public APIs, so the sites may change them without notice, and their terms of service may restrict automated access. Reviewers may also question it. The user-initiated, read-only, local-only design and the disclosure above are the strongest answer.
2. **Trademarks.** Keep the platform names factual (as in the description). Do not use their logos or brand colors in the icon or screenshots, and keep the "not affiliated" line.
3. **Review time.** Extensions with host permissions on several sites get closer review; first review can take days to weeks.
4. **Detail calls.** Item prices come from the sites' own order-detail calls (one extra request per order on the first fetch, roughly 1,000+ for a long history). They are undocumented and can change; if one stops matching, those orders silently stay estimated.
5. **Zepto request signing.** Zepto's page calls carry a signature header; the extension sends a placeholder. If Zepto starts enforcing it, Zepto fetching will fail with an error until the code is updated.
