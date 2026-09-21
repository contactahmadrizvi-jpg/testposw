import { create } from "zustand";
import type { CartItem, OrderType } from "@/types";

export type HoldOrder = {
  id: string;
  items: CartItem[];
  orderType: OrderType;
  customerName: string;
  customerPhone: string;
  tableNumber?: number;
  orderNotes?: string;
  subtotal: number;
  discount: number;
  total: number;
  createdAt: string;
};

type HoldOrdersState = {
  holdOrders: HoldOrder[];
  addHoldOrder: (order: Omit<HoldOrder, "id" | "createdAt">) => void;
  removeHoldOrder: (id: string) => void;
  updateHoldOrder: (id: string, updates: Partial<HoldOrder>) => void;
  clearAllHoldOrders: () => void;
};

const STORAGE_KEY = "pos_hold_orders";

// Load from localStorage
const loadHoldOrders = (): HoldOrder[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save to localStorage
const saveHoldOrders = (orders: HoldOrder[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error("Failed to save hold orders:", e);
  }
};

export const useHoldOrdersStore = create<HoldOrdersState>((set, get) => ({
  holdOrders: loadHoldOrders(),

  addHoldOrder: (order) => {
    const newOrder: HoldOrder = {
      ...order,
      id: `hold-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    
    set((state) => {
      const updated = [...state.holdOrders, newOrder];
      saveHoldOrders(updated);
      return { holdOrders: updated };
    });
  },

  removeHoldOrder: (id) => {
    set((state) => {
      const updated = state.holdOrders.filter((o) => o.id !== id);
      saveHoldOrders(updated);
      return { holdOrders: updated };
    });
  },

  updateHoldOrder: (id, updates) => {
    set((state) => {
      const updated = state.holdOrders.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      );
      saveHoldOrders(updated);
      return { holdOrders: updated };
    });
  },

  clearAllHoldOrders: () => {
    set({ holdOrders: [] });
    saveHoldOrders([]);
  },
}));
