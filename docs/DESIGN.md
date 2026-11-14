# Design system: three looks, one structure

Everything visual lives in `src/app/globals.css` (shared by the extension and the local web app). The look is chosen with `<html data-look="khata|pop|ink">`
(`src/lib/look.ts`, switcher in `src/components/AppHeader.tsx`, remembered per browser in `localStorage` key `mt-look`). Light/dark follows the system; `ink` is always dark.
Logic (`src/lib/**`, the service worker, storage) has nothing to do with the looks.

## The looks
| id | Name | Idea | What differs |
|---|---|---|---|
| `khata` (default) | Khata & Bill | The app shows a ledger and a stack of delivery bills, so it looks like one: cool thermal-paper surfaces (deliberately not cream), ink text, monospaced rupee figures | IBM Plex Mono for figures, dotted leader lines on totals, the Monthly set-aside card drawn as a bill with a torn bottom edge, small illustrations, 6 px corners |
| `pop` | Soft Pop | Airy and friendly | 18 px corners, pill chips, coral accent, figures in Figtree (tabular), illustrations on, no leaders |
| `ink` | Calm Dark Ink | Quiet and minimal | Always dark, one mint accent, thin rules, illustrations and leaders off |

Restraint rule (from the frontend-design skill): the data stays quiet and legible; personality lives in a few places only: the bill card, dotted leaders, four small illustrations, icons on chips.

## Tokens (CSS variables)
`--background --card --foreground --muted --border --border-strong --accent --accent-ink --warn --bad --good --c-food --c-grocery --c-ramp --radius --radius-sm --radius-chip --font-display --font-body --font-num --art-display --leader-display`.
Use tokens, never raw hex, in components (charts take `var(--c-food)` etc. directly). State colours: `--good` on track, `--warn` close to a limit, `--bad` over.
Platform brand colours (`src/lib/format.ts`) stay in charts for recognition.

**Contrast is enforced**: `node scripts/check-contrast.mjs` checks every text/background pair for every look in light and dark (4.5:1 text, 3:1 graphics and component borders) and fails the run otherwise. Run it after touching a colour.

## Type, spacing, shape
- Headlines: **Bricolage Grotesque** (variable). Interface: **Figtree** (variable). Figures: **IBM Plex Mono** 400/500/600 (khata) or Figtree tabular (pop, ink). All SIL OFL, self-hosted, latin + latin-ext subsets (latin-ext carries the ₹). ~220 KB.
- JetBrains Mono, Roboto Mono and DM Mono were rejected because they have no ₹ glyph; always verify U+20B9 before adding a font.
- Scale ×1.25 (12 14 16 20 25 31 39 px); spacing on a 4 px grid; hierarchy from size, weight and borders (1 px rules), not shadows.
- Figures use the `.num` class (`font-variant-numeric: tabular-nums`). Headings use `text-wrap: balance`.

## Components and classes
`.card` (+ `.card-primary` for KPIs and the set-aside bill), `.btn`, `.btn-primary`, `.chip` (`data-on`), `.input`, `.leader` (+ an empty `<i/>` between label and figure), `.bill`, `.num`, `.art` (hidden by the ink look), `.rise` (the one load-in), `.fillbar` (bars animate by `transform: scaleX`, never width).
Icons: `<Icon name=... />` from `src/components/art/icons.tsx` (Phosphor, MIT). Category icons come from one map there (`categoryIcon`). To add an icon, add its name to `scripts/build-icons.mjs` and run `node scripts/build-icons.mjs`.
Illustrations: `src/components/art/illustrations.tsx` (BagArt, BowlArt, BillArt, CupArt, Mark): original, one style (3 px ink strokes, one soft accent fill). Decorative (`aria-hidden`).
No emoji as icons anywhere.

## Motion and accessibility
- Only `transform` and `opacity` animate; never `transition: all`. 150 ms hover/press, one 240 ms load-in. Everything is switched off under `prefers-reduced-motion`.
- Visible `:focus-visible` outline on everything; table rows are keyboard-operable; icon-only controls and inputs have `aria-label`s; the look switcher uses `aria-pressed`.
- Layout is checked at 1280, 768 and 375 px (cards have `min-width: 0` so wide children scroll inside themselves instead of widening the page).

## Assets and licences (all bundled; the extension makes no network requests of its own)
| Asset | Licence | Where |
|---|---|---|
| Bricolage Grotesque, Figtree, IBM Plex Mono | SIL OFL 1.1 | `public/fonts/*.woff2`, licence text `public/fonts/LICENSE-*.txt` |
| Phosphor Icons (subset) | MIT | `src/components/art/icon-data.ts` (generated), `public/fonts/LICENSE-phosphor-icons.txt` |
| Illustrations, logo mark, extension icon | original to this project | `src/components/art/illustrations.tsx`, `scripts/make-icons.py` |
`scripts/build-extension.mjs` copies `public/fonts` into `dist-extension/fonts` and fails the build if the CSS references a remote URL or a missing file.
Open Doodles (CC0) and unDraw were looked at and not used: people-centred and off-subject. Stock photography is deliberately absent.

## Adding or changing a look
Add a `:root[data-look="x"]` block (and a dark block if it supports both) to `globals.css`, add it to `LOOKS` in `src/lib/look.ts`, extend `modes` in `scripts/check-contrast.mjs`, then review it at the three widths in both colour schemes.
