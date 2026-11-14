// Checks every text/background pair of every look (light and dark) against WCAG AA. Run: node scripts/check-contrast.mjs
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve(import.meta.dirname, "../src/app/globals.css"), "utf8");
const vars = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
// blocks by selector; the dark-mode media block overrides khata and pop
const blocks = {};
const lightPart = css.slice(0, css.indexOf("@media (prefers-color-scheme: dark)"));
for (const m of lightPart.matchAll(/(:root(?:,\s*:root)?\[data-look="(\w+)"\]|:root\[data-look="(\w+)"\])\s*\{([^}]*)\}/g)) blocks[m[2] ?? m[3]] = { ...(blocks[m[2] ?? m[3]] ?? {}), ...vars(m[4]) };
const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("@theme inline"));
const dark = {};
for (const m of media.matchAll(/:root(?:,\s*:root)?\[data-look="(\w+)"\]\s*\{([^}]*)\}|:root\[data-look="(\w+)"\]\s*\{([^}]*)\}/g)) dark[m[1] ?? m[3]] = vars(m[2] ?? m[4]);
const base = vars(css.match(/:root,\s*:root\[data-look="khata"\]\s*\{([^}]*)\}/)[1]);
blocks.khata = base;

const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [["foreground", "background", 4.5], ["foreground", "card", 4.5], ["muted", "background", 4.5], ["muted", "card", 4.5], ["accent-ink", "accent", 4.5],
  ["warn", "card", 4.5], ["bad", "card", 4.5], ["good", "card", 4.5], ["accent", "card", 3], ["border-strong", "card", 3], ["c-food", "card", 3], ["c-grocery", "card", 3], ["c-ramp", "card", 3]];
let bad = 0;
const modes = [["khata", "light", blocks.khata], ["khata", "dark", { ...blocks.khata, ...dark.khata }], ["pop", "light", blocks.pop], ["pop", "dark", { ...blocks.pop, ...dark.pop }], ["ink", "dark", blocks.ink]];
for (const [look, mode, v] of modes) for (const [a, b, min] of pairs) {
  const r = ratio(v[a], v[b]);
  if (r < min) { bad++; console.log(`FAIL ${look}/${mode}: ${a} ${v[a]} on ${b} ${v[b]} = ${r.toFixed(2)} (needs ${min})`); }
}
console.log(bad ? `${bad} failing pair(s)` : "all text pairs pass AA (4.5:1) and graphics pairs pass 3:1 in every look and mode");
process.exit(bad ? 1 : 0);
