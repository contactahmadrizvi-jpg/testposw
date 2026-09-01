"use client";

import { useEffect, useState, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudOff, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPendingPosOrders } from "@/lib/pos-instant";
import { getLastSyncTime, hasMenuCache } from "@/lib/menu-cache";
import { syncPendingPosOrders } from "@/services/pos-sync.service";

type SyncState = "online-synced" | "online-syncing" | "online-pending" | "offline";

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

interface SyncStatusBarProps {
  /** compact = single-line pill for the pos-kitchen header */
  compact?: boolean;
  className?: string;
}

export function SyncStatusBar({ compact = false, className }: SyncStatusBarProps) {
  const [online, setOnline] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>("online-synced");
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [menuCached, setMenuCached] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);

  const refresh = useCallback(() => {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    const pending = getPendingPosOrders();
    const pendingUnsent = pending.filter((p) => p.syncAttempts === 0 || p.syncAttempts > 0);
    setOnline(isOnline);
    setPendingCount(pendingUnsent.length);
    setLastSync(getLastSyncTime());
    setMenuCached(hasMenuCache());

    if (!isOnline) {
      setSyncState("offline");
    } else if (syncingNow) {
      setSyncState("online-syncing");
    } else if (pendingUnsent.length > 0) {
      setSyncState("online-pending");
    } else {
      setSyncState("online-synced");
    }
  }, [syncingNow]);

  // Poll state every 3 s + on network events + on pending-queue changes
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);

    const onOnline = () => { setOnline(true); refresh(); };
    const onOffline = () => { setOnline(false); setSyncState("offline"); };
    const onPending = () => refresh();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("rush-pos-pending", onPending);
    window.addEventListener("storage", onPending);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("rush-pos-pending", onPending);
      window.removeEventListener("storage", onPending);
    };
  }, [refresh]);

  // Manual sync trigger
  const handleManualSync = async () => {
    if (!online || syncingNow) return;
    setSyncingNow(true);
    setSyncState("online-syncing");
    try {
      await syncPendingPosOrders();
    } finally {
      setSyncingNow(false);
      refresh();
    }
  };

  // ── Compact pill variant (used in pos-kitchen header) ──────────────────────
  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {/* Network dot */}
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            online ? "bg-emerald-500" : "bg-red-500 animate-pulse"
          )}
        />

        {syncState === "offline" && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black text-red-700">
            <WifiOff className="h-3 w-3" />
            Offline{pendingCount > 0 ? ` · ${pendingCount} queued` : ""}
          </span>
        )}

        {syncState === "online-syncing" && (
          <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-700">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Syncing…
          </span>
        )}

        {syncState === "online-pending" && (
          <button
            type="button"
            onClick={handleManualSync}
            className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700 hover:bg-amber-200 transition active:scale-95"
            title="Tap to sync now"
          >
            <RefreshCw className="h-3 w-3" />
            {pendingCount} pending · Sync
          </button>
        )}

        {syncState === "online-synced" && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Synced
          </span>
        )}

        {/* Cache badge */}
        {menuCached && (
          <span
            className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-500 hidden sm:flex items-center gap-1"
            title={`Menu cached · Last sync: ${formatSyncTime(lastSync)}`}
          >
            <CloudOff className="h-3 w-3" />
            Cached
          </span>
        )}
      </div>
    );
  }

  // ── Full status bar variant ─────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm",
        online ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50",
        className
      )}
    >
      {/* Left: network status */}
      <div className="flex items-center gap-2 font-bold">
        {online ? (
          <Wifi className="h-4 w-4 text-emerald-600" />
        ) : (
          <WifiOff className="h-4 w-4 text-red-600 animate-pulse" />
        )}
        <span className={online ? "text-emerald-800" : "text-red-800"}>
          {online ? "Online" : "Offline"}
        </span>
      </div>

      {/* Center: sync status */}
      <div className="flex items-center gap-2 flex-1 justify-center">
        {syncState === "offline" && (
          <span className="flex items-center gap-1.5 font-semibold text-red-700 text-xs">
            <CloudOff className="h-3.5 w-3.5" />
            {pendingCount > 0
              ? `${pendingCount} order${pendingCount > 1 ? "s" : ""} saved locally — will sync when online`
              : "Working offline from cache"}
          </span>
        )}
        {syncState === "online-syncing" && (
          <span className="flex items-center gap-1.5 font-semibold text-blue-700 text-xs">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Syncing orders to Firebase…
          </span>
        )}
        {syncState === "online-pending" && (
          <button
            type="button"
            onClick={handleManualSync}
            className="flex items-center gap-1.5 font-bold text-amber-800 text-xs bg-amber-100 rounded-xl px-3 py-1.5 hover:bg-amber-200 transition active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {pendingCount} order{pendingCount > 1 ? "s" : ""} pending sync · Tap to sync now
          </button>
        )}
        {syncState === "online-synced" && (
          <span className="flex items-center gap-1.5 font-semibold text-emerald-700 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All orders synced
          </span>
        )}
      </div>

      {/* Right: cache + last sync time */}
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 shrink-0">
        <Clock className="h-3 w-3" />
        {menuCached ? (
          <span title="Menu data is cached for offline use">
            Menu cached · {formatSyncTime(lastSync)}
          </span>
        ) : (
          <span className="text-amber-600">No menu cache</span>
        )}
      </div>
    </div>
  );
}
