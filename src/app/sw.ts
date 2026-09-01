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
    {
      matcher: ({ request }: { request: Request }) =>
        request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days for offline support
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

// Let Serwist handle its events first
serwist.addEventListeners();

// Type definitions
type SWScope = WorkerGlobalScope & {
  addEventListener(type: string, listener: (event: Event) => void): void;
  clients: { claim(): Promise<void> };
};

type FetchEvent = Event & {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
  waitUntil(promise: Promise<any>): void;
};

// Add our own fetch handler AFTER Serwist's, for offline fallback only
const originalFetch = (self as any).fetch;
let serwistHandledRequest = false;

// Intercept Serwist's responses to detect when it fails
(self as unknown as SWScope).addEventListener("fetch", (event: Event) => {
  const fetchEvent = event as FetchEvent;
  const { request } = fetchEvent;

  // Only handle navigation requests (HTML pages)
  if (request.mode !== "navigate") return;

  // Let Serwist try first, then fallback to offline.html if it fails
  fetchEvent.respondWith(
    (async () => {
      try {
        // First, let all other handlers (Serwist) process this
        // We'll catch if they all fail
        const response = await originalFetch(request);
        
        // Cache successful responses
        if (response.ok) {
          const cache = await caches.open("pages-cache");
          cache.put(request, response.clone()).catch(() => {});
        }
        
        return response;
      } catch (err) {
        // Network failed, try to get from cache
        const cached = await caches.match(request);
        if (cached) {
          console.log("[SW] Serving from cache:", request.url);
          return cached;
        }

        // No cache available, serve offline fallback
        console.log("[SW] No cache, serving offline.html");
        const offlinePage = await caches.match("/offline.html");
        if (offlinePage) return offlinePage;

        // Last resort: generic offline response
        return new Response(
          `<!DOCTYPE html>
<html>
<head><title>Offline</title><meta name="viewport" content="width=device-width"></head>
<body style="font-family: system-ui; padding: 40px; text-align: center;">
  <h1>📡 You're Offline</h1>
  <p>Please connect to the internet to load the POS system.</p>
  <button onclick="location.reload()" style="padding: 15px 30px; font-size: 16px; margin-top: 20px; cursor: pointer;">Retry</button>
</body>
</html>`,
          {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/html" },
          }
        );
      }
    })()
  );
});

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
      // Only claim if we're the active worker (wait a tick to ensure activation is complete)
      await new Promise(resolve => setTimeout(resolve, 10));
      try {
        await (self as unknown as SWScope).clients.claim();
        console.log("[SW] Activated and claimed clients");
      } catch (e) {
        console.log("[SW] Could not claim clients (already active):", e);
      }
    })()
  );
});
