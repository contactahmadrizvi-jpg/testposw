/**
 * Admin Panel Cache Manager
 * Provides instant loading for admin pages with localStorage caching
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

const CACHE_VERSION = '1.0';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export class AdminCache {
  private static prefix = 'admin_cache_';

  /**
   * Set cached data with timestamp and version
   */
  static set<T>(key: string, data: T): void {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(entry));
    } catch (error) {
      console.warn('[AdminCache] Failed to cache:', key, error);
      // If localStorage is full, clear old caches
      this.clearOldCaches();
    }
  }

  /**
   * Get cached data if valid and not expired
   */
  static get<T>(key: string, maxAge: number = CACHE_DURATION): T | null {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      
      // Check version
      if (entry.version !== CACHE_VERSION) {
        this.remove(key);
        return null;
      }

      // Check expiry
      const age = Date.now() - entry.timestamp;
      if (age > maxAge) {
        this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('[AdminCache] Failed to read cache:', key, error);
      return null;
    }
  }

  /**
   * Remove specific cache entry
   */
  static remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.warn('[AdminCache] Failed to remove cache:', key, error);
    }
  }

  /**
   * Clear all admin caches
   */
  static clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      console.log('[AdminCache] Cleared all caches');
    } catch (error) {
      console.warn('[AdminCache] Failed to clear caches:', error);
    }
  }

  /**
   * Clear caches older than specified age
   */
  static clearOldCaches(maxAge: number = 24 * 60 * 60 * 1000): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      
      keys.forEach(key => {
        if (!key.startsWith(this.prefix)) return;
        
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return;
          
          const entry: CacheEntry<any> = JSON.parse(raw);
          const age = now - entry.timestamp;
          
          if (age > maxAge || entry.version !== CACHE_VERSION) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Invalid entry, remove it
          localStorage.removeItem(key);
        }
      });
      
      console.log('[AdminCache] Cleared old caches');
    } catch (error) {
      console.warn('[AdminCache] Failed to clear old caches:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): { count: number; totalSize: number } {
    try {
      const keys = Object.keys(localStorage);
      const adminKeys = keys.filter(k => k.startsWith(this.prefix));
      
      let totalSize = 0;
      adminKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      });
      
      return {
        count: adminKeys.length,
        totalSize: Math.round(totalSize / 1024), // KB
      };
    } catch (error) {
      return { count: 0, totalSize: 0 };
    }
  }
}

// Auto-cleanup on page load
if (typeof window !== 'undefined') {
  // Clear old caches on startup (24 hours+)
  AdminCache.clearOldCaches();
  
  // Log cache stats in dev mode
  if (process.env.NODE_ENV === 'development') {
    const stats = AdminCache.getStats();
    console.log(`[AdminCache] ${stats.count} entries, ${stats.totalSize}KB`);
  }
}
