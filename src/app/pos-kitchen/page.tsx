"use client";

import { useState } from "react";
import POSPage from "../pos/page";
import KitchenPage from "../kitchen/page";
import { Monitor, ChefHat, Wifi, WifiOff } from "lucide-react";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { SomoLogo } from "@/components/somo-logo";

export default function PosKitchenUnifiedPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "kitchen">("pos");
  const [isOnline, setIsOnline] = useState(true);

  // Monitor online/offline status
  useState(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      {/* Ultra Professional Header */}
      <div className="shrink-0 border-b border-border card-premium shadow-2xl relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        
        {/* Main Header Row */}
        <div className="flex h-[88px] items-center justify-between px-8 gap-6 relative">
          {/* Left: Brand & Logo */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-primary/10 border border-primary/20">
              <SomoLogo size="md" showText={true} />
              <div className="h-8 w-px bg-border ml-1" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">POS System</span>
            </div>
          </div>

          {/* Center: Premium Tab Selector */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl border-2 border-border bg-gradient-to-b from-secondary/40 to-secondary/60 shadow-lg backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setActiveTab("pos")}
              className={`
                flex items-center gap-3 rounded-xl px-8 py-3.5 text-sm font-black uppercase tracking-wide
                transition-all duration-300 relative overflow-hidden group
                ${activeTab === "pos"
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow-xl shadow-primary/40 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }
              `}
            >
              {activeTab === "pos" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              )}
              <Monitor className="h-5 w-5 relative z-10" />
              <span className="relative z-10">Point of Sale</span>
            </button>
            
            <button
              type="button"
              onClick={() => setActiveTab("kitchen")}
              className={`
                flex items-center gap-3 rounded-xl px-8 py-3.5 text-sm font-black uppercase tracking-wide
                transition-all duration-300 relative overflow-hidden group
                ${activeTab === "kitchen"
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow-xl shadow-primary/40 scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }
              `}
            >
              {activeTab === "kitchen" && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              )}
              <ChefHat className="h-5 w-5 relative z-10" />
              <span className="relative z-10">Kitchen Display</span>
            </button>
          </div>

          {/* Right: Online Status & Sync */}
          <div className="flex items-center gap-3">
            {/* Online/Offline Badge */}
            <div className={`
              flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider
              transition-all duration-300 border-2
              ${isOnline 
                ? "bg-green-500/10 border-green-500/30 text-green-400" 
                : "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse-slow"
              }
            `}>
              {isOnline ? (
                <>
                  <Wifi className="h-4 w-4" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Compact Sync Status */}
            <SyncStatusBar compact />
          </div>
        </div>

        {/* Full Sync Status Bar */}
        <div className="px-8 pb-4">
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
