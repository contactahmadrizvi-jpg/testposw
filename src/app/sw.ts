/**
 * sw.ts — Serwist/Workbox service worker for SOMO POS
 *
 * Caching strategy:
 *  • App shell / JS / CSS  → CacheFirst (long-lived, versioned by build hash)
 *  • Next.js RSC / pages   → NetworkFirst (fresh when online, cached fallback offline)
 *  • Menu images (ibb.co, Firebase Storage, etc.) → StaleWhileRevalidate
 *  • Google Fonts          → CacheFirst
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

// Serwist injects the precache manifest here at build time.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

// Use WorkerGlobalScope (present in webworker lib) instead of
// ServiceWorkerGlobalScope (not available in dom lib).
declare const self: WorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  precacheEntries: (self as unknown as { __SW_MANIFEST: (PrecacheEntry | string)[] | undefined }).__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,

  runtimeCaching: [
    // ── Next.js pages — NetworkFirst so updates always come through ──
    {
      matcher: ({ request }: { request: Request }) =>
        (request as Request & { mode: string }).mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages-cache",
        networkTimeoutSeconds: 5,
        plugins: [
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 }),
        ],
      }),
    },

    // ── Next.js static assets (_next/static) — CacheFirst ──
    {
      matcher: ({ url }: { url: URL }) => url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 500,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },

    // ── Menu / food images from all allowed hosts ──
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

    // ── Fallthrough ──
    ...defaultCache,
  ],
});

serwist.addEventListeners();
