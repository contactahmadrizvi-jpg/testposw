/**
 * sw.ts — Serwist/Workbox service worker for SOMO POS
 *
 * Offline strategy:
 *  • Navigation (HTML pages) → NetworkFirst 3s timeout → cache fallback
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
  skipWaiting: true,
  clientsClaim: false,
  navigationPreload: false,

  runtimeCaching: [
    // ── Critical offline pages — StaleWhileRevalidate ──
    {
      matcher: ({ url }: { url: URL }) =>
        url.pathname === "/pos-kitchen" ||
        url.pathname === "/pos" ||
        url.pathname === "/kitchen",
      handler: new StaleWhileRevalidate({
        cacheName: "offline-pages",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 10,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },

    // ── Next.js static assets — CacheFirst ──
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

    // ── HTML page navigations — NetworkFirst with short timeout ──
    {
      matcher: ({ request }: { request: Request }) =>
        request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
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

// Type definitions
type SWScope = WorkerGlobalScope & {
  addEventListener(type: string, listener: (event: Event) => void): void;
  clients: { claim(): Promise<void> };
};

// Precache offline.html on activation
(self as unknown as SWScope).addEventListener("activate", (event: Event) => {
  console.log("[SW] Activating...");
  (event as Event & { waitUntil(p: Promise<unknown>): void }).waitUntil(
    (async () => {
      try {
        const cache = await caches.open("offline-fallback");
        await cache.add("/offline.html");
        console.log("[SW] Offline fallback precached");
      } catch (e) {
        console.warn("[SW] Failed to precache offline.html:", e);
      }
      // Small delay to ensure activation is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        await (self as unknown as SWScope).clients.claim();
        console.log("[SW] Activated successfully");
      } catch (e) {
        // Ignore claim errors - they're harmless
      }
    })()
  );
});
