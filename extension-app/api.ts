// Extension implementation of the dashboard's Api (swapped in for src/lib/api.ts at build time).
import type { Api, FetchEvent } from "../src/lib/api-types";
import * as store from "./store";

export const api: Api = {
  loadOrders: store.listOrders,
  listGoals: store.listGoals,
  saveGoals: store.saveGoals,
  deleteGoal: store.deleteGoal,
  listPrices: store.listPrices,
  setPrice: store.setPrice,
  canFetch: async () => true,

  fetchOrders: (platforms, on) =>
    new Promise<void>((resolve) => {
      const port = chrome.runtime.connect({ name: "fetch" });
      let finished = false;
      const end = () => { if (finished) return; finished = true; on({ type: "done" }); resolve(); };
      port.onMessage.addListener((m: FetchEvent) => { if (m.type === "done") end(); else on(m); });
      port.onDisconnect.addListener(end);
      port.postMessage({ platforms });
    }),

  reportBadge() { /* the service worker updates the badge itself when stored data changes */ },
  backup: { exportJson: store.exportJson, importJson: store.importJson, clearAll: store.clearAll },
};
