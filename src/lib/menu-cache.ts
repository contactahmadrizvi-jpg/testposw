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
    console.log(`[Cache] safeGet(${key}): ${raw ? `${raw.length} chars` : 'null'}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    console.log(`[Cache] safeGet(${key}): parsed successfully, type=${typeof parsed}`);
    return parsed;
  } catch (error) {
    console.error(`[Cache] safeGet(${key}) failed:`, error);
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    console.log(`[Cache] Saved ${key}: ${(serialized.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error(`[Cache] Failed to save ${key}:`, error);
    // Storage quota exceeded — silently ignore; app still works, just no cache update.
  }
}

// ─── public write API (called after every successful Firebase response) ───────

export function cacheCategories(categories: MenuCategory[]): void {
  safeSet(KEYS.categories, categories);
  safeSet(KEYS.lastSync, new Date().toISOString());
}

export function cacheMenuItems(items: MenuItem[]): void {
  console.log("[Cache] cacheMenuItems() called with", items.length, "items");
  console.log("[Cache] First item sample:", items[0]?.name);
  try {
    const serialized = JSON.stringify(items);
    console.log("[Cache] Serialized size:", (serialized.length / 1024).toFixed(2), "KB");
    console.log("[Cache] Writing to key:", KEYS.items);
    localStorage.setItem(KEYS.items, serialized);
    
    // Verify it was written
    const verification = localStorage.getItem(KEYS.items);
    console.log("[Cache] Verification read:", verification ? `${(verification.length / 1024).toFixed(2)} KB` : "NULL");
    
    console.log("[Cache] ✅ Successfully wrote menu items to localStorage");
    safeSet(KEYS.lastSync, new Date().toISOString());
    // Fire-and-forget image pre-cache
    void prefetchMenuImages(items);
  } catch (error) {
    console.error("[Cache] ❌ Failed to cache menu items:", error);
    // Try without images if quota exceeded
    try {
      const itemsWithoutImages = items.map(item => ({ ...item, imageUrl: undefined }));
      localStorage.setItem(KEYS.items, JSON.stringify(itemsWithoutImages));
      console.log("[Cache] ✅ Saved items without images (quota issue)");
    } catch (e2) {
      console.error("[Cache] ❌ Failed even without images:", e2);
    }
  }
}

export function cacheDeals(deals: Deal[]): void {
  safeSet(KEYS.deals, deals);
}

// ─── public read API (called when offline / Firebase unavailable) ─────────────

export function loadCachedCategories(): MenuCategory[] {
  return safeGet<MenuCategory[]>(KEYS.categories) ?? [];
}

export function loadCachedMenuItems(): MenuItem[] {
  console.log("[Cache] loadCachedMenuItems() called");
  const items = safeGet<MenuItem[]>(KEYS.items) ?? [];
  console.log("[Cache] Raw items from localStorage:", items.length);
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
