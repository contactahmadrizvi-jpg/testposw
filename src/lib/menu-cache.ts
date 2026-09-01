/**
 * menu-cache.ts
 *
 * Offline-first menu cache backed by localStorage (fast, synchronous,
 * works without any extra IndexedDB plumbing on top of Firestore's own
 * persistentLocalCache).
 *
 * Strategy:
 *  - After every successful Firebase fetch/subscribe the latest data is
 *    written here so it survives a full network loss.
 *  - On startup (or when Firebase throws because we're offline) the POS /
 *    Kitchen pages call the load* helpers to get the last-known-good data
 *    instantly — no spinner, no empty screen.
 *  - Menu images are pre-fetched and stored as base64 data-URLs so item
 *    photos render even with zero connectivity.
 */

import type { MenuCategory, MenuItem, Deal } from "@/types";

// ─── storage keys ────────────────────────────────────────────────────────────
const KEYS = {
  categories: "offline_menu_categories",
  items: "offline_menu_items",
  deals: "offline_menu_deals",
  imagePrefix: "offline_img_", // + btoa(url)
  lastSync: "offline_menu_last_sync",
} as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded — silently ignore; app still works, just no cache update.
  }
}

// ─── public write API (called after every successful Firebase response) ───────

export function cacheCategories(categories: MenuCategory[]): void {
  safeSet(KEYS.categories, categories);
  safeSet(KEYS.lastSync, new Date().toISOString());
}

export function cacheMenuItems(items: MenuItem[]): void {
  safeSet(KEYS.items, items);
  safeSet(KEYS.lastSync, new Date().toISOString());
  // Fire-and-forget image pre-cache
  void prefetchMenuImages(items);
}

export function cacheDeals(deals: Deal[]): void {
  safeSet(KEYS.deals, deals);
}

// ─── public read API (called when offline / Firebase unavailable) ─────────────

export function loadCachedCategories(): MenuCategory[] {
  return safeGet<MenuCategory[]>(KEYS.categories) ?? [];
}

export function loadCachedMenuItems(): MenuItem[] {
  const items = safeGet<MenuItem[]>(KEYS.items) ?? [];
  // Swap in locally-cached image data-URLs so images render without network
  return items.map((item) => {
    if (!item.imageUrl) return item;
    const cached = getCachedImage(item.imageUrl);
    return cached ? { ...item, imageUrl: cached } : item;
  });
}

export function loadCachedDeals(): Deal[] {
  return safeGet<Deal[]>(KEYS.deals) ?? [];
}

export function getLastSyncTime(): string | null {
  return safeGet<string>(KEYS.lastSync);
}

export function hasMenuCache(): boolean {
  const items = safeGet<MenuItem[]>(KEYS.items);
  return Array.isArray(items) && items.length > 0;
}

// ─── image caching ────────────────────────────────────────────────────────────

function imageKey(url: string): string {
  // Use a simple hash instead of btoa to avoid issues with non-ASCII URLs
  return KEYS.imagePrefix + url.replace(/[^a-zA-Z0-9]/g, "_").slice(-80);
}

export function getCachedImage(url: string): string | null {
  return safeGet<string>(imageKey(url));
}

/**
 * Downloads images as blob → base64 data-URL and stores them in localStorage.
 * Runs silently in the background; failures are ignored.
 */
export async function prefetchMenuImages(items: MenuItem[]): Promise<void> {
  if (typeof window === "undefined") return;

  const urls = items
    .map((i) => i.imageUrl)
    .filter((u): u is string => typeof u === "string" && u.length > 0 && !u.startsWith("data:"));

  for (const url of urls) {
    const key = imageKey(url);
    // Skip if already cached
    if (localStorage.getItem(key)) continue;
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      safeSet(key, dataUrl);
    } catch {
      // Network error — skip silently
    }
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
