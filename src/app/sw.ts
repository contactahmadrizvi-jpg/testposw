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
  clientsClaim: true, // Force immediate takeover
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

// Precache offline.html on activation and cleanup old caches
(self as unknown as SWScope).addEventListener("activate", (event: Event) => {
  console.log("[SW] Activating...");
  (event as Event & { waitUntil(p: Promise<unknown>): void }).waitUntil(
    (async () => {
      try {
        // Delete all old caches except our current ones
        const cacheNames = await caches.keys();
        const cachesToKeep = [
          "offline-pages",
          "next-static",
          "pages-cache",
          "menu-images",
          "google-fonts",
          "offline-fallback",
          "pages-rsc-prefetch",
          "pages-rsc",
          "pages",
        ];
        await Promise.all(
          cacheNames
            .filter((name) => !cachesToKeep.includes(name))
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            })
        );

        const cache = await caches.open("offline-fallback");
        await cache.add("/offline.html");
        console.log("[SW] Offline fallback precached");
      } catch (e) {
        console.warn("[SW] Failed during activation:", e);
      }
      
      // Small delay to ensure activation is complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        await (self as unknown as SWScope).clients.claim();
        console.log("[SW] Activated successfully - claimed all clients");
      } catch (e) {
        console.warn("[SW] Failed to claim clients:", e);
      }
    })()
  );
});

// Handle fetch errors gracefully (including missing precached chunks)
(self as unknown as SWScope).addEventListener("fetch", (event: Event) => {
  const fetchEvent = event as FetchEvent;
  
  // Don't interfere with Serwist's handling - just add error recovery
  const originalResponse = fetchEvent.respondWith;
  fetchEvent.respondWith = function(response: Response | Promise<Response>) {
    return originalResponse.call(this, 
      Promise.resolve(response).catch(async (error) => {
        console.warn("[SW] Fetch failed, attempting fallback:", error);
        
        // If it's a navigation request and we have the offline page, use it
        if (fetchEvent.request.mode === "navigate") {
          const cache = await caches.open("offline-fallback");
          const offlinePage = await cache.match("/offline.html");
          if (offlinePage) {
            return offlinePage;
          }
        }
        
        // Otherwise, throw the error
        throw error;
      })
    );
  };
});
