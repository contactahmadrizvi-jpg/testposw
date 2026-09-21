"use client";

import { useState, useEffect } from "react";
import POSPage from "../pos/page";
import KitchenPage from "../kitchen/page";
import { Monitor, ChefHat, Wifi, WifiOff } from "lucide-react";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { SomoLogo } from "@/components/somo-logo";
import { RESTAURANT } from "@/constants";

export default function PosKitchenUnifiedPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "kitchen">("pos");
  const [isOnline, setIsOnline] = useState(true);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    // Set initial state
    setIsOnline(navigator.onLine);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Ultra Professional Header */}
      <div className="shrink-0 border-b border-border card-premium shadow-xl relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        
        {/* Main Header Row */}
        <div className="flex h-[64px] items-center justify-between px-4 gap-4 relative">
          {/* Left: Brand & Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
              <SomoLogo size="sm" showText={true} />
              <div className="h-6 w-px bg-border ml-0.5" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">POS</span>
            </div>
          </div>

          {/* Center: Premium Tab Selector */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl border-2 border-border bg-gradient-to-b from-secondary/40 to-secondary/60 shadow-md backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setActiveTab("pos")}
              className={`
                flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wide
                transition-all duration-300 relative overflow-hidden group
                ${activeTab === "pos"
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/40 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }
              `}
            >
              {activeTab === "pos" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              )}
              <Monitor className="h-4 w-4 relative z-10" />
              <span className="relative z-10">Point of Sale</span>
            </button>
            
            <button
              type="button"
              onClick={() => setActiveTab("kitchen")}
              className={`
                flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wide
                transition-all duration-300 relative overflow-hidden group
                ${activeTab === "kitchen"
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/40 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }
              `}
            >
              {activeTab === "kitchen" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              )}
              <ChefHat className="h-4 w-4 relative z-10" />
              <span className="relative z-10">Kitchen Display</span>
            </button>
          </div>

          {/* Right: Online Status & Sync */}
          <div className="flex items-center gap-2">
            {/* Online/Offline Badge */}
            <div className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider
              transition-all duration-300 border-2
              ${isOnline 
                ? "bg-green-500/10 border-green-500/30 text-green-400" 
                : "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse-slow"
              }
            `}>
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Compact Sync Status */}
            <SyncStatusBar compact />
          </div>
        </div>

        {/* Full Sync Status Bar */}
        <div className="px-4 pb-2">
          <SyncStatusBar />
        </div>
      </div>

      {/* Page Content with Smooth Transition */}
      <div className="flex-1 min-h-0 w-full overflow-hidden relative">
        <div className={`
          absolute inset-0 transition-all duration-500 ease-in-out
          ${activeTab === "pos" ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"}
        `}>
          <POSPage />
        </div>
        <div className={`
          absolute inset-0 transition-all duration-500 ease-in-out
          ${activeTab === "kitchen" ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"}
        `}>
          <KitchenPage />
        </div>
      </div>
    </div>
  );
}
