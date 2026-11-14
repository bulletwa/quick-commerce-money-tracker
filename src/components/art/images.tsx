/* Bundled imagery: 3D illustrations (Microsoft Fluent UI Emoji, MIT) and a few food photographs (Unsplash licence). See docs/CREDITS.md. */

/** Relative to the page, so it works from the extension's dashboard.html and from the Next app. */
export const asset = (p: string) => `img/${p}`;

/** A 3D illustration by file name (without .png). Decorative unless `alt` is given. width/height are set so nothing shifts while it loads. */
export function Art3D({ name, size = 48, alt = "", className, eager }: { name: string; size?: number; alt?: string; className?: string; eager?: boolean }) {
  return <img src={asset(`3d/${name}.png`)} width={size} height={size} alt={alt} aria-hidden={alt ? undefined : true} className={className} loading={eager ? "eager" : "lazy"} decoding="async" draggable={false} />;
}

export const PHOTOS = {
  welcome: { file: "thali-welcome.webp", w: 1200, h: 900, credit: "Zoshua Colah", page: "https://unsplash.com/photos/indian-thali-is-served-with-side-dishes-gep3f7NQzZY" },
  warm: { file: "thali-warm.webp", w: 1200, h: 800, credit: "Gayatri Malhotra", page: "https://unsplash.com/photos/cooked-food-on-round-tray-mlwXrYYAOms" },
  groceries: { file: "grocery-bags.webp", w: 1200, h: 800, credit: "Mockuuups", page: "https://unsplash.com/photos/a-table-topped-with-bags-filled-with-different-types-of-vegetables-HeP33WOkVqM" },
} as const;

export function Photo({ id, className, alt = "", eager }: { id: keyof typeof PHOTOS; className?: string; alt?: string; eager?: boolean }) {
  const p = PHOTOS[id];
  return <img src={asset(`photos/${p.file}`)} width={p.w} height={p.h} alt={alt} aria-hidden={alt ? undefined : true} className={className} loading={eager ? "eager" : "lazy"} decoding="async" />;
}

/** One illustration per category; unknown categories get a plain basket. */
const CATEGORY_ART: Record<string, string> = {
  "Apparel & Accessories": "t-shirt", "Bakery & Bread": "bread", Beverages: "hot-beverage", "Biryani & Rice": "cooked-rice", "Breakfast & Cereal": "egg",
  "Chinese & Asian": "steaming-bowl", "Cleaning & Household": "broom", "Dairy & Eggs": "cheese-wedge", Desserts: "birthday-cake", "Dry Fruits & Nuts": "peanuts",
  "Electronics & Appliances": "electric-plug", "Frozen Food": "snowflake", "Fruits & Vegetables": "carrot", "Hardware & Tools": "wrench", "Health & Pharmacy": "pill",
  "Home & Kitchen": "pot-of-food", "Indian Mains": "curry-rice", "Lifestyle & Accessories": "sparkles", "Meals & Combos": "bento-box", "Meat & Seafood": "cut-of-meat",
  "Other Food": "fork-and-knife-with-plate", "Other Grocery": "basket", "Pasta & Instant Food": "spaghetti", "Personal Care & Beauty": "sparkling-heart", "Pizza & Burgers": "pizza",
  "Puja & Festive": "sparkles", "Sauces & Spices": "hot-pepper", Snacks: "popcorn", Staples: "seedling", "Stationery, Gifts & Toys": "wrapped-gift",
  "Sweets & Chocolates": "chocolate-bar", Tobacco: "package",
};
export const categoryArt = (c: string) => CATEGORY_ART[c] ?? "basket";
