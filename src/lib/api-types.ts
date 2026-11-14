import type { Prices } from "./analytics/amounts";
import type { Goal } from "./goals";
import type { Order, Platform } from "./types";

export type FetchEvent =
  | { type: "progress"; platform: string; done: number; of: number; found: number; what?: "prices" }
  | { type: "error"; platform: string; error: string }
  | { type: "imported"; platform: string; added: number; updated: number; skipped: number; priced?: number; failed?: number }
  | { type: "done" };

export type LoginState = "in" | "out" | "unknown";

/** Everything the dashboard needs from "the outside". The local-server build and the Chrome-extension build each implement it. */
export interface Api {
  loadOrders(): Promise<Order[]>;
  listGoals(): Promise<Goal[]>;
  saveGoals(goals: unknown): Promise<Goal[]>;
  deleteGoal(id: string): Promise<Goal[]>;
  /** what the user says they usually pay per unit of an item (makes category amounts exact for that item) */
  listPrices(): Promise<Prices>;
  setPrice(name: string, price: number | null): Promise<Prices>;
  /** false when the fetcher (the extension, for the web build) is not available */
  canFetch(): Promise<boolean>;
  fetchOrders(platforms: readonly Platform[], on: (e: FetchEvent) => void): Promise<void>;
  /** is the user logged in to each site? "unknown" = could not tell (site busy or changed) */
  checkConnections(platforms: readonly Platform[], on: (platform: Platform, state: LoginState) => void): Promise<void>;
  /** icon badge: goals over / near their limit (no-op where there is no extension) */
  reportBadge(over: number, warn: number): void;
  /** extension build only */
  backup?: { exportJson(): Promise<string>; importJson(json: string): Promise<{ orders: number; goals: number }>; clearAll(): Promise<void> };
}
