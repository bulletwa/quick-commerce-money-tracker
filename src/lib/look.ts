/** The three looks (see src/app/globals.css). The choice is a per-browser preference kept in localStorage; nothing depends on it working. */
export const LOOKS = [
  { id: "khata", name: "Khata & Bill", short: "Khata", blurb: "Paper, ink and monospaced figures" },
  { id: "pop", name: "Soft Pop", short: "Pop", blurb: "Airy, rounded, brighter" },
  { id: "ink", name: "Calm Dark Ink", short: "Ink", blurb: "Dark, quiet, one mint accent" },
] as const;
export type Look = (typeof LOOKS)[number]["id"];

export function getLook(): Look {
  try { const v = localStorage.getItem("mt-look"); if (LOOKS.some((l) => l.id === v)) return v as Look; } catch { /* storage can be blocked */ }
  return "khata";
}
export function applyLook(l: Look, save = true) {
  document.documentElement.dataset.look = l;
  if (save) { try { localStorage.setItem("mt-look", l); } catch { /* preference only */ } }
}
