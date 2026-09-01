# Offline Mode Guide

## Overview

The POS & Kitchen system includes comprehensive offline support, allowing staff to continue taking orders and viewing kitchen tickets even when internet connectivity is lost.

## How It Works

### 1. **Service Worker** (`public/sw.js`)
- Precaches essential routes: `/pos-kitchen`, `/pos`, `/kitchen`, `/login`
- Caches all app assets (JS, CSS, images) after first visit
- Intercepts network requests and serves cached versions when offline

### 2. **localStorage Cache** (`src/lib/menu-cache.ts`)
- Automatically saves menu items, categories, and deals to `localStorage` after every Firebase sync
- Menu item images are converted to base64 data URLs and cached
- Cache keys:
  - `offline_menu_items` - Array of menu items
  - `offline_menu_categories` - Array of categories
  - `offline_menu_deals` - Array of active deals
  - `offline_img_<hash>` - Base64-encoded menu item images
  - `offline_menu_last_sync` - Timestamp of last cache update

### 3. **Instant POS Queue** (`src/lib/pos-instant.ts`)
- Pending orders are stored in `localStorage` as `rush_pos_pending_orders`
- Orders are automatically synced to Firestore when connection returns
- Kitchen display shows local pending orders immediately

## Usage Instructions

### For Staff

1. **Initial Setup (Requires Internet)**
   - Visit https://testposw.vercel.app/pos-kitchen with internet
   - Wait for menu items to load (this populates the cache)
   - The system is now ready for offline use

2. **Going Offline**
   - If internet drops, the app continues working automatically
   - Menu items load instantly from cache
   - Orders are queued locally and sync when connection returns
   - A sync status indicator shows connection state

3. **Reconnecting**
   - Pending orders automatically upload to Firestore
   - Kitchen display updates with new orders
   - Cache refreshes with latest menu data

### For Developers/Testing

1. **Test Offline Mode Locally**
   ```bash
   # Build production version (SW only works in production)
   npm run build
   npm start
   
   # Visit http://localhost:3000/pos-kitchen
   # Open DevTools → Application → Service Workers (verify SW is active)
   # Open DevTools → Network → Set throttling to "Offline"
   # Refresh page - menu should load from cache
   ```

2. **Test on Vercel**
   ```bash
   # Visit https://testposw.vercel.app/pos-kitchen
   # Open DevTools Console (check for cache logs)
   # Open DevTools → Application → Local Storage → check for offline_menu_items
   # Go offline: DevTools → Network → Offline
   # Refresh - should load from cache
   ```

3. **Debug Cache Issues**
   - Check console for logs:
     - `[POS] Loaded X cached menu items from localStorage`
     - `[POS] Caching X menu items to localStorage`
   - Verify localStorage keys exist in DevTools → Application → Local Storage
   - Check Service Worker status in DevTools → Application → Service Workers

## Architecture Details

### Cache Loading Flow

```
1. Page loads (SSR renders empty skeleton)
2. useLayoutEffect (runs BEFORE first paint):
   ├─ loadCachedMenuItems() → reads localStorage
   ├─ If cache exists → setMenu(cached) + setMenuLoading(false)
   └─ Sets hasCachedData.current = true
3. useEffect (runs after mount):
   ├─ Starts Firebase subscription
   ├─ Skips offline timer if hasCachedData = true
   └─ Updates cache when Firebase emits new data
```

### Offline Detection

The app uses multiple signals to detect offline state:
- `navigator.onLine` - Browser offline API
- Firebase connection state (`connectFirestore` with `experimentalAutoDetectLongPolling`)
- Service Worker fetch failures

### Sync Strategy

- **Optimistic UI**: Orders appear immediately in local queue
- **Background Sync**: Pending orders sync automatically when connection returns
- **Conflict Resolution**: Last-write-wins (no complex CRDT needed for POS use case)

## Files Modified for Offline Support

- `src/app/pos/page.tsx` - Added `useLayoutEffect` cache loading + `hasCachedData` flag
- `src/app/kitchen/page.tsx` - Same offline loading pattern
- `src/lib/menu-cache.ts` - localStorage-based cache layer
- `src/lib/pos-instant.ts` - Local order queue with auto-sync
- `public/manifest.json` - Fixed icons to use existing `/logo.jpeg`
- `next.config.ts` - Precache configuration for Serwist
- `src/app/sw.ts` - Service Worker with NetworkFirst + CacheFirst strategies

## Known Limitations

1. **First Visit Requires Internet** - Cache must be populated on first visit
2. **Image Storage Limits** - localStorage has ~5-10MB limit (sufficient for ~50-100 menu items with images)
3. **No Background Sync API** - Uses periodic checks instead of true background sync
4. **Firebase Auth Requires Online** - Login/auth cannot work offline (session tokens persist)

## Troubleshooting

### "No internet connection" message appears even with cached data

**Cause**: Cache wasn't populated (first visit was offline)  
**Fix**: Visit the page with internet once to populate cache

### Menu loads but images are missing

**Cause**: Images failed to convert to base64 or localStorage quota exceeded  
**Fix**: Check console for errors, clear localStorage and reload with internet

### Orders not syncing after reconnection

**Cause**: Firebase credentials expired or sync worker stopped  
**Fix**: Reload page - sync worker restarts on mount

### Service Worker not activating

**Cause**: HTTPS required for SW (works on localhost or Vercel, not HTTP production)  
**Fix**: Ensure deployment uses HTTPS

## Future Enhancements

- [ ] IndexedDB for larger cache capacity
- [ ] Background Sync API for more reliable syncing
- [ ] Offline-first conflict resolution UI
- [ ] Cache version management (auto-invalidate stale data)
- [ ] Periodic background cache refresh (when idle + online)
