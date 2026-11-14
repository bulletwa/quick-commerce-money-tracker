/*
 * Four original spot illustrations, one style: 3 px ink strokes (currentColor), one soft accent fill, round joins. Decorative only.
 * They are hidden in the "ink" look through the .art class.
 */
type P = { size?: number; className?: string };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const fill = { fill: "var(--accent)", fillOpacity: 0.2, stroke: "currentColor", strokeWidth: 3, strokeLinejoin: "round" } as const;
const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg viewBox="0 0 120 120" width={size} height={size} className={className} aria-hidden="true" focusable="false">{children}</svg>
);

/** Grocery bag with a carrot top poking out. */
export function BagArt({ size = 120, className }: P) {
  return svg(size, className, <>
    <path d="M32 48 H88 L94 104 Q94 108 90 108 H30 Q26 108 26 104 Z" {...fill} />
    <path d="M46 48 C46 30 74 30 74 48" {...stroke} />
    <path d="M60 48 C58 36 52 30 46 27 M60 48 C62 34 70 28 77 26 M60 48 C60 38 60 32 62 24" {...stroke} />
    <path d="M42 72 H78" {...stroke} strokeDasharray="1 8" />
  </>);
}
/** A steaming bowl. */
export function BowlArt({ size = 120, className }: P) {
  return svg(size, className, <>
    <path d="M22 62 H98 C98 86 82 102 60 102 C38 102 22 86 22 62 Z" {...fill} />
    <path d="M46 52 C42 44 50 40 46 32 M60 52 C56 44 64 40 60 32 M74 52 C70 44 78 40 74 32" {...stroke} />
    <path d="M46 108 H74" {...stroke} />
  </>);
}
/** A bill with a torn bottom edge and a few ruled lines. */
export function BillArt({ size = 120, className }: P) {
  return svg(size, className, <>
    <path d="M30 14 H90 V104 L84 98 L78 104 L72 98 L66 104 L60 98 L54 104 L48 98 L42 104 L36 98 L30 104 Z" {...fill} />
    <path d="M42 34 H78 M42 48 H78 M42 62 H66" {...stroke} />
    <circle cx="76" cy="78" r="7" fill="var(--accent)" fillOpacity="0.55" stroke="currentColor" strokeWidth="3" />
  </>);
}
/** A cup of chai on a saucer. */
export function CupArt({ size = 120, className }: P) {
  return svg(size, className, <>
    <path d="M30 54 H84 V72 C84 88 74 98 57 98 C40 98 30 88 30 72 Z" {...fill} />
    <path d="M84 60 C100 60 100 80 82 80" {...stroke} />
    <path d="M24 106 H90" {...stroke} />
    <path d="M46 44 C42 38 50 34 46 28 M62 44 C58 38 66 34 62 28" {...stroke} />
  </>);
}

/** The logo mark: a small bill. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M9 7 H23 V25 L20.5 23 L18 25 L16 23 L14 25 L11.5 23 L9 25 Z" fill="var(--accent-ink)" />
      <path d="M12 12 H20 M12 16 H20 M12 20 H17" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
