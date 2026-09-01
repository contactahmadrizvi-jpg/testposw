import { createOrder } from "@/services/orders.service";
import {
  getPendingPosOrders,
  markPendingFailed,
  removePendingByLocalId,
} from "@/lib/pos-instant";

let syncing = false;

/** Saves pending POS orders to Firestore in the background */
export async function syncPendingPosOrders(): Promise<void> {
  if (syncing || typeof window === "undefined") return;
  const pending = getPendingPosOrders();
  if (!pending.length) return;

  syncing = true;
  try {
    for (const item of pending) {
      try {
        await createOrder({
          ...item.input,
          predefinedOrderId: item.localId,
          skipStockCheck: true,
        });
        removePendingByLocalId(item.localId);
      } catch {
        markPendingFailed(item.localId);
      }
    }
  } finally {
    syncing = false;
  }
}

/**
 * Starts the background sync worker.
 *
 * Triggers on:
 *  1. Immediately on startup (flush any pending orders from a previous session)
 *  2. Every 8 seconds (polling fallback)
 *  3. window "online" event — browser regained network
 *  4. Firestore network restore — detected by listening for a successful
 *     Firestore write-attempt after a failure. We reuse the "online" event
 *     path for simplicity since Firebase SDK queues writes internally and
 *     flushes them as soon as it reconnects; we just need to remove the
 *     matching localStorage entries once that happens.
 */
export function startPosSyncWorker(): () => void {
  if (typeof window === "undefined") return () => {};

  // Immediate flush
  void syncPendingPosOrders();

  // Polling every 8 s
  const intervalId = window.setInterval(
    () => void syncPendingPosOrders(),
    8_000
  );

  // Sync on browser network restore
  const onOnline = () => {
    // Small delay so Firebase SDK can re-establish its WebSocket first
    setTimeout(() => void syncPendingPosOrders(), 1_500);
  };
  window.addEventListener("online", onOnline);

  // Sync whenever the Firebase SDK signals it has reconnected.
  // The SDK dispatches its own "firestore-network-enabled" on the window
  // when the internal network layer comes back up (e.g. tab regains focus
  // with cached writes pending). We listen for it as a belt-and-suspenders
  // approach alongside the browser "online" event.
  const onFirestoreOnline = () => {
    setTimeout(() => void syncPendingPosOrders(), 500);
  };
  window.addEventListener("firestore-network-enabled", onFirestoreOnline);

  // Also sync when the page becomes visible again (e.g. switching back from
  // another tab / waking up the device)
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      void syncPendingPosOrders();
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("firestore-network-enabled", onFirestoreOnline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
