"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating banner shown at the top of POS / Kitchen pages when the browser
 * has no network connection. Disappears automatically once connectivity is
 * restored. The banner is purely visual — the actual offline-first logic is
 * handled by Firestore persistence + the pos-instant queue.
 */
export function OfflineIndicator({ className }: { className?: string }) {
  const [online, setOnline] = useState(true);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    // Initialise from current state (not always "online" on first load)
    setOnline(navigator.onLine);

    const handleOnline = () => {
      setOnline(true);
      setJustReconnected(true);
      // Hide the "reconnected" badge after 3 s
      setTimeout(() => setJustReconnected(false), 3000);
    };
    const handleOffline = () => {
      setOnline(false);
      setJustReconnected(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online && !justReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold shadow-md transition-all",
        online
          ? "bg-emerald-500 text-white"
          : "bg-red-500 text-white animate-pulse",
        className
      )}
    >
      {online ? (
        <>
          <Wifi className="h-3.5 w-3.5" />
          Back online — syncing…
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          Offline — orders saved locally
        </>
      )}
    </div>
  );
}
