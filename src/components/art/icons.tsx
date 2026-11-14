import { ICON_DATA } from "./icon-data";

export type IconName = keyof typeof ICON_DATA;

/** A Phosphor icon (MIT) inlined from icon-data.ts. Decorative by default; pass `label` when the icon alone carries meaning. */
export function Icon({ name, size = 16, label, className }: { name: string; size?: number; label?: string; className?: string }) {
  const inner = ICON_DATA[name] ?? ICON_DATA.tag;
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      focusable="false" dangerouslySetInnerHTML={{ __html: inner }} />
  );
}

/** One icon per category, so chips and lists read at a glance. Unknown categories get a neutral tag. */
const CATEGORY_ICON: Record<string, string> = {
  "Apparel & Accessories": "t-shirt", "Bakery & Bread": "bread", Beverages: "coffee", "Biryani & Rice": "cooking-pot", "Breakfast & Cereal": "egg",
  "Chinese & Asian": "bowl-steam", "Cleaning & Household": "broom", "Dairy & Eggs": "cheese", Desserts: "cake", "Dry Fruits & Nuts": "acorn",
  "Electronics & Appliances": "plug", "Frozen Food": "snowflake", "Fruits & Vegetables": "carrot", "Hardware & Tools": "wrench", "Health & Pharmacy": "pill",
  "Home & Kitchen": "cooking-pot", "Indian Mains": "bowl-food", "Lifestyle & Accessories": "watch", "Meals & Combos": "fork-knife", "Meat & Seafood": "fish",
  "Other Food": "fork-knife", "Other Grocery": "basket", "Pasta & Instant Food": "bowl-steam", "Personal Care & Beauty": "sparkle", "Pizza & Burgers": "pizza",
  "Puja & Festive": "flower-lotus", "Sauces & Spices": "pepper", Snacks: "popcorn", Staples: "grains", "Stationery, Gifts & Toys": "gift",
  "Sweets & Chocolates": "cookie", Tobacco: "cigarette",
};
export const categoryIcon = (c: string) => CATEGORY_ICON[c] ?? "tag";
