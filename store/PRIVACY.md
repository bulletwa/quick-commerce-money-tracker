# Privacy Policy: Quick Commerce Money Tracker

_Last updated: 14 November 2026_

Quick Commerce Money Tracker ("the extension") helps you understand your own spending on food delivery and quick-commerce grocery orders.

## What the extension does with your data

- **When you click "Fetch orders"**, the extension reads your own order history from Zomato, Swiggy, Instamart, Blinkit and Zepto, using the login you already have in your browser. It does nothing until you click.
- It keeps only these fields per order: order id, date and time, store or restaurant name, item names and quantities, prices and totals, fees and discounts, and the platform. It does **not** store your name, phone number, address, payment details or passwords. To make its requests the extension uses the session you are already logged in with inside each site's own page; it never stores or transmits your login or tokens.
- Orders, your budgets and your goals are stored **only in your browser's local extension storage** (`chrome.storage.local`) on your device.

## What we do not do

- We do **not** collect, transmit, sell or share any data. The extension has no server, no analytics, no tracking and no advertising. It makes no network requests except the ones you trigger to the five delivery sites above, to read your own history.
- No data is used for creditworthiness, lending or any purpose unrelated to showing you your own spending.
- No remote code is loaded; everything the extension runs ships inside the package.

## Your control

- **Export backup** saves your data to a file you choose. **Import backup** loads one.
- **Delete all data** in the dashboard erases everything the extension stored. Removing the extension also deletes its data.

## Permissions, and why

| Permission | Why |
|---|---|
| Access to zomato.com, swiggy.com, instamart.in, blinkit.com, zepto.com (and Zepto's API host) | To read your own order history from those sites when you click Fetch orders |
| `scripting` | To run the order-history reader inside those sites' pages, where your login applies |
| `storage` | To keep your orders, budgets and goals on your device |

## Not affiliated

This extension is independent. It is not affiliated with, endorsed by or sponsored by Zomato, Swiggy, Instamart, Blinkit or Zepto. Those names are used only to say which services it works with.

## Changes and contact

If this policy changes, the date above changes and the new version ships with the extension update.
Contact: <add your support email before publishing>
