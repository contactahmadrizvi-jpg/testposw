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

  skipWaiting: true,
  clientsClaim: false,
  navigationPreload: false,

  runtimeCaching: [
    // ── Critical offline pages — CacheFirst with network update ──
    // These pages MUST work offline, so we aggressively cache them
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
            // Cache pages for 7 days for offline support
            maxAgeSeconds: 7 * 24 * 60 * 60,
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

// Custom offline fallback for navigation requests
(self as unknown as SWScope).addEventListener("fetch", async (event: Event) => {
  const fetchEvent = event as FetchEvent;
  const { request } = fetchEvent;
  
  // Only handle navigation requests (page loads)
  if (request.mode !== "navigate") return;

  fetchEvent.respondWith(
    (async () => {
      try {
        // Try network first with short timeout
        const networkResponse = await Promise.race([
          fetch(request),
          new Promise<Response>((_, reject) => 
            setTimeout(() => reject(new Error("timeout")), 4000)
          )
        ]);
        
        // Cache successful response
        if (networkResponse.ok) {
          const cache = await caches.open("pages-cache");
          cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (networkError) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          console.log("[SW] Serving from cache:", request.url);
          return cachedResponse;
        }
        
        // No cache, show offline page
        console.log("[SW] No cache, serving offline fallback");
        const offlinePage = await caches.match("/offline.html");
        return offlinePage || new Response("Offline - No cached content available", {
          status: 503,
          statusText: "Service Unavailable"
        });
      }
    })()
  );
});

// Claim clients manually after activation — avoids the race condition
// where clientsClaim() fires before the SW is active.
// Use plain Event type to stay within the dom lib (no webworker lib needed).
type SWScope = WorkerGlobalScope & {
  addEventListener(type: string, listener: (event: Event) => void): void;
  clients: { claim(): Promise<void> };
  navigator: { onLine: boolean };
};

type FetchEvent = Event & {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
};

(self as unknown as SWScope).addEventListener("activate", (event: Event) => {
  (event as Event & { waitUntil(p: Promise<unknown>): void }).waitUntil(
    (self as unknown as SWScope).clients.claim()
  );
});
