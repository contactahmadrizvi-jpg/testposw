/**
 * sw.ts — Serwist/Workbox service worker for SOMO POS
 *
 * Offline strategy:
 *  • Navigation (HTML pages) → NetworkFirst 4s timeout → cache fallback
 *  • Next.js static assets   → CacheFirst (content-hashed, safe forever)
 *  • Menu images             → StaleWhileRevalidate (7-day cache)
 *  • Google Fonts            → CacheFirst (1-year cache)
 *  • Everything else         → Serwist defaultCache
 */

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  Serwist,
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
  ExpirationPlugin,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope & typeof globalThis;

const manifest = (
  self as unknown as { __SW_MANIFEST: (PrecacheEntry | string)[] | undefined }
).__SW_MANIFEST;

const serwist = new Serwist({
  precacheEntries: manifest,

  // skipWaiting: true makes the new SW take over immediately on install.
  // clientsClaim is intentionally false here — we call clients.claim()
  // manually inside the activate event AFTER the SW is fully active,
  // which avoids the "Only the active worker can claim clients" error.
  skipWaiting: true,
  clientsClaim: false,

  // navigationPreload disabled — causes ERR_FAILED when completely offline
  // because the browser tries to start the preload request before the SW
  // intercept fires, and that request fails with no network.
  navigationPreload: false,

  runtimeCaching: [
    // ── Next.js static assets — CacheFirst (hashed filenames) ──
    {
      matcher: ({ url }: { url: URL }) =>
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/static/"),
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 1000,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          }),
        ],
      }),
    },

    // ── HTML page navigations — NetworkFirst, falls back to cache ──
    // Use a short 4s timeout. If the network is completely down, the
    // NetworkFirst handler falls back to the cached copy.
    // This prevents React hydration mismatches (#418) because online
    // users always get fresh HTML, and offline users get the cache.
    {
      matcher: ({ request }: { request: Request }) =>
        request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 4,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            // Only cache pages for 1 hour — short enough that a new
            // deployment's HTML will be fetched fresh on the next visit.
            maxAgeSeconds: 60 * 60,
          }),
        ],
      }),
    },

    // ── Menu / food images ──
    {
      matcher: ({ url }: { url: URL }) =>
        url.hostname === "i.ibb.co" ||
        url.hostname === "i.imgbb.com" ||
        url.hostname === "firebasestorage.googleapis.com" ||
        url.hostname === "images.unsplash.com",
      handler: new StaleWhileRevalidate({
        cacheName: "menu-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 300,
            maxAgeSeconds: 7 * 24 * 60 * 60,
            purgeOnQuotaError: true,
          }),
        ],
      }),
    },

    // ── Google Fonts ──
    {
      matcher: ({ url }: { url: URL }) =>
        url.hostname === "fonts.googleapis.com" ||
        url.hostname === "fonts.gstatic.com",
      handler: new CacheFirst({
        cacheName: "google-fonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          }),
        ],
      }),
    },

    ...defaultCache,
  ],
});

serwist.addEventListeners();

// Claim clients manually after activation so there's no race condition.
// By the time "activate" fires the SW IS the active worker, so
// clients.claim() is safe. We use WorkerGlobalScope (available in the
// dom lib) instead of ServiceWorkerGlobalScope (not in dom lib).
type SWScope = WorkerGlobalScope & {
  addEventListener(type: string, listener: (event: ExtendableEvent) => void): void;
  clients: { claim(): Promise<void> };
};

(self as unknown as SWScope).addEventListener(
  "activate",
  (event: ExtendableEvent) => {
    event.waitUntil((self as unknown as SWScope).clients.claim());
  }
);
