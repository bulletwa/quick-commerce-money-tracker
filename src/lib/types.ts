export const PLATFORMS = ["zomato", "swiggy", "instamart", "blinkit", "zepto"] as const;
export type Platform = (typeof PLATFORMS)[number];
export type OrderType = "food" | "grocery";

export interface OrderItem {
  name: string; // normalised display name, e.g. "Chicken Biryani"
  rawName: string;
  qty: number;
  unitPrice: number; // INR
  category: string;
  amount?: number; // INR attributed to this line (set by allocate(): exact, entered by the user, or estimated)
  basis?: "exact" | "entered" | "estimated";
}

export interface Order {
  id: string; // platform order id (unique per platform)
  platform: Platform;
  type: OrderType;
  placedAt: string; // ISO
  vendor: string; // restaurant or store
  itemTotal: number;
  fees: number; // delivery + handling + platform + taxes
  discount: number;
  tip: number;
  total: number; // amount actually paid
  items: OrderItem[];
  allUnits?: number; // set by filters: item units in the whole order before items were narrowed
  fullTotal?: number; // set by a category filter: what was actually paid for the whole order (total/itemTotal/fees are then the selected items' share)
  lo?: number; hi?: number; // set with `partial`: the selected part cannot be below `lo` or above `hi`
  partial?: boolean; // true when only some of the order's items are counted (category filter)
  itemsPriced?: boolean; // false = item names/counts known but not their prices (spend-by-item must skip them)
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  zomato: "Zomato",
  swiggy: "Swiggy",
  instamart: "Instamart",
  blinkit: "Blinkit",
  zepto: "Zepto",
};
