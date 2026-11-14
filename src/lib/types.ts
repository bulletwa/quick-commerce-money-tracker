export const PLATFORMS = ["zomato", "swiggy", "instamart", "blinkit", "zepto"] as const;
export type Platform = (typeof PLATFORMS)[number];
export type OrderType = "food" | "grocery";

export interface OrderItem {
  name: string; // normalised display name, e.g. "Chicken Biryani"
  rawName: string;
  qty: number;
  unitPrice: number; // INR
  category: string;
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
  itemsPriced?: boolean; // false = item names/counts known but not their prices (spend-by-item must skip them)
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  zomato: "Zomato",
  swiggy: "Swiggy",
  instamart: "Instamart",
  blinkit: "Blinkit",
  zepto: "Zepto",
};
