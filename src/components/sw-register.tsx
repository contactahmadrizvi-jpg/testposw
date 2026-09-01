"use client";

import { useEffect } from "react";

/**
 * Registers the Serwist/Workbox service worker in production only.
 * In development the SW is disabled to prevent it from intercepting
 * Firebase auth and Firestore requests, which causes infinite loading.
 */
export function SWRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    // Unregister any stale dev SW that might be running
    navigator.serviceWorker.getRegistrations().then((regs) => {
      // In production, only keep /sw.js — unregister anything else
      regs.forEach((reg) => {
        if (!reg.active?.scriptURL.endsWith("/sw.js")) {
          reg.unregister();
        }
      });
    });

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registered, scope:", reg.scope);
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
  }, []);

  return null;
}
