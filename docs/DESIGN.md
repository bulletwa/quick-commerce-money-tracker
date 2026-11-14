# Design: "Plate", a friendly tabbed app

Why this exists: the first designs only repainted one long, data-dense page, and it still felt like a business portal. The rebuild changes the
*structure* (tabs, guided setup, a one-glance Home) and adds imagery and warmth. Visual code lives in `src/app/globals.css` (shared by the extension
and the local web app); logic (`src/lib/**`, service worker, storage) is independent of it.

## Principles and where they come from
| Principle | Source | How it shows up |
|---|---|---|
| Onboarding should be fast, fun and optional; teach by doing; postpone nonessential setup | Apple HIG: Onboarding | 3-step guided setup (`app/Setup.tsx`): welcome, connect apps, read orders. Skippable; replay from Settings |
| Skip tutorial decks unless context is needed | NN/g: Mobile app onboarding | Setup is functional (logins), not instructional. One-time `Tip`s sit next to the thing they explain |
| Tab bars: few tabs, labelled, never hidden; badges only for critical info | Apple HIG: Tab bars | Home, Spending, Orders, Goals, Settings. Badge only on Goals, only when a goal is over its limit |
| Empty states show status, teach what will appear, give a path | NN/g: Empty states | `Empty` (app/ui.tsx) with a 3D illustration and a button on every tab |
| Progressive disclosure, two levels at most | NN/g | Filters: search, dates, apps, type first; "More filters" holds dates, amounts, categories. Spending shows one total and one of four sections at a time |
| Loading: show something at once, let people keep working | Apple HIG: Loading; NN/g response times | Reading orders runs above the tabs (`app/Fetch.tsx`), so switching tabs never stops it |
| Delight: visual, behavioural, reflective | NN/g: Pillars of delight | 3D art; one-glance Home; "About you" story cards. Bad news is stated plainly, never joked about |
| Keep labels; offer a calm option | Google Material 3 Expressive research | Tab labels always shown; Calm appearance in Settings |
| Common patterns, big targets, consistency | Zomato Sushi design system | 44 px minimum targets, one component kit |
| Undo beats confirm dialogs | Web Interface Guidelines | `Toast` with Undo for removing a goal and deleting all data |

## Structure
- `app/AppShell.tsx`: top tab bar on wide screens, bottom bar on phones; route is the URL hash (`#/home`, `#/spending`, `#/orders`, `#/goals`, `#/settings`, `#/setup`).
- `app/Data.tsx` (orders, prices, filters, derived values), `app/Fetch.tsx` (read progress), `app/Toast.tsx`.
- `tabs/Home.tsx`: two-column hero (month ring on the left; "Stay up to date" with Read new orders and the Monthly set-aside shortcut on the right), then "About you" story cards from `src/lib/stories.ts` (a row of equal cards on wide screens, swipeable on phones).
- `tabs/Spending.tsx`: one big total (food vs groceries bar, orders, average order, per month), then four sections shown one at a time: Overview (over-time chart + by app), Favourites (dishes, groceries), Where it goes (categories, restaurants, fees/tips/savings), When (day x hour grid).
  Ranked data uses the `Bars` component (plain div bars, top 6 + "Show all") instead of axis charts, so labels cannot clip. Lesson from user feedback: a page of 15 cards, each with its own totals, reads as "bombarded"; lead with one number and reveal the rest on request.
- `OrdersTab.tsx` (cards on phones, table on wide screens), `GoalsTab.tsx`, `Settings.tsx`.
- Home's ring limit: the user's own "all / spend" goal if any, else the recommended set-aside from the last full months.
- Story cards never mention tobacco or health items (`SENSITIVE` in `src/lib/goals.ts`; covered by a test).

## Looks
`<html data-look="plate|calm">` (`src/lib/look.ts`, switcher in Settings, `localStorage` key `mt-look`). `plate` (default): light lilac-white with aubergine ink, chilli
primary, mango/mint/berry tiles; dark when the system is dark. `calm`: always dark, one mint accent.

## Tokens
`--background --card --foreground --muted --border --border-strong --accent --accent-ink --warn --bad --good --berry --mango --tile-chilli/berry/mango/mint --radius --radius-sm --shadow --font-display --font-body`.
Use tokens, never raw hex, in components. Colour is never the only signal (the Home ring also says "On track / Close / Over" in words).
`node scripts/check-contrast.mjs` enforces WCAG AA for text (4.5:1) and graphics (3:1) in every look and mode.

## Type, motion
Bricolage Grotesque (display, numbers) and Figtree (UI), self-hosted woff2 with latin-ext for the rupee sign. Motion (`rise`, `pop`, `bob`, ring fill) is off under `prefers-reduced-motion`.

## Imagery and licences (all bundled, no network requests)
- 58 3D illustrations from Microsoft Fluent UI Emoji (MIT) in `public/img/3d/`; mapped to categories in `components/art/images.tsx` (`categoryArt`).
- 3 Unsplash photos (Unsplash licence) in `public/img/photos/`; credits in `docs/CREDITS.md` and Settings > About. Unsplash+ photos are not allowed.
- Small UI icons: Phosphor (MIT), subset built by `scripts/build-icons.mjs`. Tab icons are drawn for this app.
- No logos of Zomato, Swiggy etc. (trademarks): platforms are a coloured initial.
- Asset pipeline: `scripts/build-art.py` (Pillow). The extension build fails if CSS references a remote URL or a missing file.
