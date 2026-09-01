"use client";

import { useState } from "react";
import POSPage from "../pos/page";
import KitchenPage from "../kitchen/page";
import { Monitor, ChefHat } from "lucide-react";
import { SyncStatusBar } from "@/components/sync-status-bar";

export default function PosKitchenUnifiedPage() {
  const [activeTab, setActiveTab] = useState<"pos" | "kitchen">("pos");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50">
      {/* ── Top Header ── */}
      <div className="shrink-0 border-b bg-white shadow-sm">
        {/* Tab selector row */}
        <div className="flex h-14 items-center justify-between px-4 gap-3">
          {/* Tab pills */}
          <div className="flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("pos")}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === "pos"
                  ? "bg-primary text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Monitor className="h-4 w-4" />
              POS
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("kitchen")}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === "kitchen"
                  ? "bg-primary text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <ChefHat className="h-4 w-4" />
              Kitchen
            </button>
          </div>

          {/* Compact sync pill — always visible */}
          <SyncStatusBar compact />
        </div>

        {/* Full sync status bar — shown below tabs */}
        <div className="px-4 pb-2">
          <SyncStatusBar />
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        {activeTab === "pos" ? <POSPage /> : <KitchenPage />}
      </div>
    </div>
  );
}
