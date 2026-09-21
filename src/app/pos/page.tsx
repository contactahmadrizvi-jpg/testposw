"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MenuItemImage } from "@/components/menu-item-image";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  ShoppingBag,
  User,
  Phone,
  Utensils,
  ArrowLeft,
  Minus,
  Plus,
  Sparkles,
  MapPin,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePOSStore } from "@/stores/pos-store";
import { useHoldOrdersStore, type HoldOrder } from "@/stores/hold-orders-store";
import { subscribeMenuItems, getActiveCategories, getActiveDeals } from "@/services/menu.service";
import { checkStockForOrderItems, getRecipeAvailabilityMap, getMaxOrderable } from "@/services/inventory.service";
import type { CreateOrderInput } from "@/services/orders.service";
import { subscribeKitchenOrders } from "@/services/orders.service";
import { preloadPrintHeader, printReceiptDouble, printKOT } from "@/lib/print";
import { buildInstantPosOrder } from "@/lib/pos-instant";
import { startPosSyncWorker } from "@/services/pos-sync.service";
import { formatCurrency, cn, normalizePhone, isValidPhone } from "@/lib/utils";
import { getFirestoreDb } from "@/lib/firebase/config";
import type { Deal, MenuItem, OrderItem, OrderType, MenuCategory, CartItemCustomization } from "@/types";
import { useAuthStore } from "@/stores/auth-store";
import { userHasPermission } from "@/lib/permissions";
import { RESTAURANT } from "@/constants";
import { FoodGridSkeleton } from "@/components/ui/loading-skeletons";
import { OfflineIndicator } from "@/components/offline-indicator";
import {
  cacheCategories,
  cacheMenuItems,
  cacheDeals,
  loadCachedCategories,
  loadCachedMenuItems,
  loadCachedDeals,
} from "@/lib/menu-cache";

const CATEGORY_LABEL: Record<string, string> = {
  "cat-shawarma": "Shawarma",
  "cat-wraps": "Wraps",
  "cat-beef-burger": "Burgers",
  "cat-chicken-burger": "Chicken",
  "cat-paratha": "Paratha",
  "cat-sides": "Sides",
  "cat-pizza": "Pizza",
  "cat-premium-pizza": "Premium",
};

const ORDER_TYPES: { id: OrderType; label: string; icon: string }[] = [
  { id: "dine_in", label: "Dine in", icon: "🍽️" },
  { id: "takeaway", label: "Takeaway", icon: "🥡" },
  { id: "delivery", label: "Delivery", icon: "🛵" },
];

const DEALS_CATEGORY_ID = "__deals__";

export default function POSPage() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const authLoading = useAuthStore((s) => s.loading);

  // Start with empty/loading state (safe for SSR).
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [paying, setPaying] = useState(false);
  const [menuLoading, setMenuLoading] = useState(true);
  const [showDialpad, setShowDialpad] = useState(false);
  const [cartStep, setCartStep] = useState<"cart" | "details">("cart");
  const [activeView, setActiveView] = useState<"menu" | "hold">("menu");

  // Delivery state — delivery is always Lahore (LHR)
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("Lahore");
  const [deliveryCharges, setDeliveryCharges] = useState(0);

  // Order description / special instructions (printed on KOT & receipt)
  const [orderNotes, setOrderNotes] = useState("");

  // Inventory stock limits (max orderable per item) — POS/kitchen orders only
  const [availability, setAvailability] = useState<Map<string, number> | null>(null);

  // Autocomplete
  const [savedCustomers, setSavedCustomers] = useState<any[]>([]);
  const [phoneSuggestions, setPhoneSuggestions] = useState<any[]>([]);

  // Active orders for table occupation
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  const {
    items,
    orderType,
    customerName,
    customerPhone,
    tableNumber,
    setOrderType,
    setTableNumber,
    addItem,
    addDeal,
    removeItem,
    updateQty,
    clearOrder,
    getSubtotal,
    setCustomer,
  } = usePOSStore();

  // Hold orders store
  const { holdOrders, addHoldOrder, removeHoldOrder } = useHoldOrdersStore();

  // Load hold order into cart for editing
  const loadHoldOrderForEdit = useCallback((holdOrder: HoldOrder) => {
    // Clear current cart
    clearOrder();
    
    // Load order details
    setOrderType(holdOrder.orderType);
    setCustomer(holdOrder.customerName, holdOrder.customerPhone);
    if (holdOrder.tableNumber) setTableNumber(holdOrder.tableNumber);
    if (holdOrder.orderNotes) setOrderNotes(holdOrder.orderNotes);
    
    // Load items into cart
    holdOrder.items.forEach((item) => {
      if (item.isDeal && item.dealSnapshot) {
        // Reconstruct deal from snapshot
        const deal: Deal = {
          id: item.dealSnapshot.dealId,
          title: item.menuItem.name,
          description: "",
          menuItemIds: item.dealSnapshot.items.map((i: any) => i.menuItemId),
          itemQuantities: item.dealSnapshot.items.reduce((acc: any, i: any) => ({...acc, [i.menuItemId]: i.quantity}), {}),
          itemPrices: item.dealSnapshot.items.reduce((acc: any, i: any) => ({...acc, [i.menuItemId]: i.price}), {}),
          discountPercent: 0,
          fixedPrice: item.subtotal,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addDeal(deal, menu);
      } else {
        // Add regular item
        addItem(item.menuItem, item.quantity, item.customization);
      }
    });
    
    // Remove from hold
    removeHoldOrder(holdOrder.id);
    
    // Switch to menu view and cart step
    setActiveView("menu");
    setCartStep("cart");
    
    toast.success(`Table #${holdOrder.tableNumber} loaded for editing`, {
      description: "Modify items and re-submit when ready",
    });
  }, [clearOrder, setOrderType, setCustomer, setTableNumber, addItem, addDeal, removeHoldOrder, menu]);

  // Print receipt for held order (without sending to kitchen)
  const printHoldReceipt = useCallback(async (holdOrder: HoldOrder) => {
    const orderItems: OrderItem[] = holdOrder.items.map((line, i) => ({
      id: `hold-${i}`,
      menuItemId: line.menuItem.id,
      name: line.menuItem.name,
      price: line.unitPrice,
      quantity: line.quantity,
      customization: line.customization,
      subtotal: line.subtotal,
      ...(line.dealSnapshot ? { dealSnapshot: line.dealSnapshot } : {}),
    }));

    const inputData: CreateOrderInput = {
      customerName: holdOrder.customerName,
      customerPhone: holdOrder.customerPhone,
      type: holdOrder.orderType,
      items: orderItems,
      subtotal: holdOrder.subtotal,
      tax: 0,
      deliveryCharge: 0,
      discount: holdOrder.discount,
      total: holdOrder.total,
      source: "pos",
      paymentMethod: "cash",
      status: "received",
      kitchenStatus: "new",
      createdBy: profile?.id,
      tableNumber: holdOrder.tableNumber,
      ...(holdOrder.orderNotes ? { deliveryNotes: holdOrder.orderNotes } : {}),
    };

    try {
      const { order } = buildInstantPosOrder(inputData);
      await printReceiptDouble(order);
      toast.success("Receipt printed successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to print receipt");
    }
  }, [profile]);

  // Send held order to kitchen (print receipt only - KOT already printed)
  const sendHoldOrderToKitchen = useCallback(async (holdOrder: HoldOrder) => {
    const orderItems: OrderItem[] = holdOrder.items.map((line, i) => ({
      id: `hold-${i}`,
      menuItemId: line.menuItem.id,
      name: line.menuItem.name,
      price: line.unitPrice,
      quantity: line.quantity,
      customization: line.customization,
      subtotal: line.subtotal,
      ...(line.dealSnapshot ? { dealSnapshot: line.dealSnapshot } : {}),
    }));

    const inputData: CreateOrderInput = {
      customerName: holdOrder.customerName,
      customerPhone: holdOrder.customerPhone,
      type: holdOrder.orderType,
      items: orderItems,
      subtotal: holdOrder.subtotal,
      tax: 0,
      deliveryCharge: 0,
      discount: holdOrder.discount,
      total: holdOrder.total,
      source: "pos",
      paymentMethod: "cash",
      status: "received",
      kitchenStatus: "new",
      createdBy: profile?.id,
      tableNumber: holdOrder.tableNumber,
      ...(holdOrder.orderNotes ? { deliveryNotes: holdOrder.orderNotes } : {}),
    };

    try {
      const { order } = buildInstantPosOrder(inputData);
      
      // Print receipt only (KOT was already printed when order was placed)
      await printReceiptDouble(order);
      
      // Remove from hold
      removeHoldOrder(holdOrder.id);
      
      toast.success(`Receipt printed for Table #${holdOrder.tableNumber}!`, {
        description: "Order completed and removed from hold",
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to print receipt");
    }
  }, [profile, removeHoldOrder]);

  // ── Load cache immediately on mount (before any Firebase calls) ──
  useLayoutEffect(() => {
    console.log('[POS] 🚀 Loading cached data...');
    const startTime = performance.now();
    
    const cached = loadCachedMenuItems();
    const cachedCats = loadCachedCategories();
    const cachedDeals = loadCachedDeals();
    
    if (cached.length > 0) {
      setMenu(cached);
      setMenuLoading(false);
      console.log(`[POS] ✅ Loaded ${cached.length} items in ${(performance.now() - startTime).toFixed(2)}ms`);
    }
    if (cachedCats.length > 0) setCategories(cachedCats);
    if (cachedDeals.length > 0) setDeals(cachedDeals);
  }, []);

  // ── Auth permission guard ──
  useEffect(() => {
    if (authLoading) return;
    if (profile && !userHasPermission(profile, "pos") && !userHasPermission(profile, "*")) {
      router.replace("/admin");
    }
  }, [authLoading, profile, router]);

  useEffect(() => {
    preloadPrintHeader();
    const stopSync = startPosSyncWorker();
    const offlineTimer = setTimeout(() => setMenuLoading(false), 3000); // Reduced from 6s to 3s

    // ── Firebase subscriptions (only update if we get data) ──
    // Run these in parallel for faster loading
    Promise.all([
      getActiveCategories()
        .then((cats) => { if (cats.length > 0) { setCategories(cats); cacheCategories(cats); } })
        .catch(() => {}),
      
      getActiveDeals()
        .then((d) => { if (d.length > 0) { setDeals(d); cacheDeals(d); } })
        .catch(() => {}),
    ]);

    const unsub = subscribeMenuItems((items) => {
      clearTimeout(offlineTimer);
      // Only update menu if we got data
      if (items.length > 0) {
        setMenu(items);
        setMenuLoading(false);
        cacheMenuItems(items);
        console.log(`[POS] 📡 Synced ${items.length} items from Firebase`);
      }
    });

    const unsubKitchen = subscribeKitchenOrders((orders) => {
      setActiveOrders(orders);
    });
    const loaded = JSON.parse(localStorage.getItem("pos_saved_customers") || "[]");
    setSavedCustomers(loaded);
    return () => {
      clearTimeout(offlineTimer);
      unsub();
      unsubKitchen();
      stopSync();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load inventory availability (max orderable per item) for stock blocking ──
  useEffect(() => {
    const load = () => {
      getRecipeAvailabilityMap()
        .then((map) => setAvailability(map))
        .catch(() => {}); // offline: keep last known limits
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const subtotal = getSubtotal();
  const originalSubtotal = useMemo(() => items.reduce((s, i) => s + (i.unitPrice * i.quantity), 0), [items]);
  const totalItemDiscounts = useMemo(() => items.reduce((s, i) => s + (i.discountAmount || 0), 0), [items]);
  const total = subtotal;
  const discount = totalItemDiscounts;

  const occupiedTables = useMemo(() => {
    return activeOrders
      .filter((o) => o.type === "dine_in" && o.tableNumber != null)
      .map((o) => o.tableNumber as number);
  }, [activeOrders]);

  const isDealsTab = activeCategory === DEALS_CATEGORY_ID;

  const filtered = useMemo(() => {
    console.log("[POS] Computing filtered menu:", { 
      isDealsTab, 
      menuLength: menu.length, 
      activeCategory, 
      search 
    });
    if (isDealsTab) return [];
    let list = menu;
    if (activeCategory !== "all") {
      list = list.filter((m) => m.categoryId === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q));
    }
    console.log("[POS] Filtered result:", list.length, "items");
    return list;
  }, [menu, activeCategory, search, isDealsTab]);

  const filteredDeals = useMemo(() => {
    if (!isDealsTab) return [];
    if (!search.trim()) return deals;
    const q = search.toLowerCase();
    return deals.filter((d) => d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
  }, [deals, isDealsTab, search]);

  // Deals matching the search query — surfaced above menu results on non-deals tabs
  const searchDeals = useMemo(() => {
    if (isDealsTab || !search.trim()) return [];
    const q = search.toLowerCase();
    return deals.filter((d) => d.title.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
  }, [deals, isDealsTab, search]);

  // Total qty of a menu item already in the POS cart (all customizations)
  const getPosInCartQty = useCallback(
    (menuItemId: string) =>
      items.filter((l) => !l.isDeal && l.menuItem.id === menuItemId).reduce((s, l) => s + l.quantity, 0),
    [items]
  );

  // Add to POS cart — blocked when inventory stock cannot cover it
  const tryAddPosItem = useCallback(
    (item: MenuItem, custom: CartItemCustomization = {}) => {
      const max = getMaxOrderable(availability, item.id, custom.variantId);
      if (max !== undefined) {
        if (max <= 0) {
          toast.error(`${item.name} is out of stock`);
          return;
        }
        if (getPosInCartQty(item.id) >= max) {
          toast.error(`Only ${max} × ${item.name} can be ordered (stock limit)`);
          return;
        }
      }
      addItem(item, 1, custom);
    },
    [availability, getPosInCartQty, addItem]
  );

  const selectSuggestion = (s: any) => {
    setCustomer(s.name, normalizePhone(s.phone || ""));
    setStreet(s.street || "");
    setCity("Lahore");
    setDeliveryCharges(s.deliveryCharges || 0);
    setPhoneSuggestions([]);
  };

  const handleDialpadPress = (val: string) => {
    let current = String(tableNumber ?? "");
    if (val === "C") {
      setTableNumber(undefined);
    } else if (val === "back") {
      const next = current.slice(0, -1);
      setTableNumber(next ? Number(next) : undefined);
    } else {
      const next = current + val;
      setTableNumber(Number(next));
    }
  };

  const placeOrder = useCallback(async () => {
    if (paying) return;
    if (!items.length) { toast.error("Tap items to add to cart"); return; }
    if (orderType === "dine_in" && tableNumber == null) { toast.error("Table number is required for Dine-in orders"); return; }
    if (orderType === "dine_in" && tableNumber != null && occupiedTables.includes(tableNumber)) {
      toast.error(`Table #${tableNumber} is already occupied/reserved! Please choose another table.`);
      return;
    }
    if (orderType === "delivery") {
      if (!customerName.trim()) { toast.error("Customer name is required for delivery orders"); return; }
      if (!customerPhone.trim()) { toast.error("Customer phone is required for delivery orders"); return; }
      if (!street.trim()) { toast.error("Street / House No. / Address is required for delivery orders"); return; }
      if (!city.trim()) { toast.error("City is required for delivery orders"); return; }
    }

    const nameToUse = customerName.trim() || "Walk-in Customer";
    const phoneToUse = customerPhone.trim() || "";

    if (phoneToUse && !isValidPhone(phoneToUse)) {
      toast.error("Phone number must be 11 digits starting with 0 (e.g. 03001234567)");
      return;
    }

    if (orderType === "delivery" && phoneToUse) {
      const newSaved = { phone: phoneToUse, name: nameToUse, street, city, deliveryCharges };
      const filteredList = savedCustomers.filter((c: any) => c.phone !== phoneToUse);
      const updatedList = [newSaved, ...filteredList];
      localStorage.setItem("pos_saved_customers", JSON.stringify(updatedList));
      setSavedCustomers(updatedList);
    }

    const orderItems: OrderItem[] = items.map((line, i) => ({
      id: `pos-${i}`,
      menuItemId: line.menuItem.id,
      name: line.menuItem.name,
      price: line.unitPrice,
      quantity: line.quantity,
      customization: line.customization,
      subtotal: line.subtotal,
      // Pass deal snapshot through so inventory service uses correct per-item quantities
      ...(line.dealSnapshot ? { dealSnapshot: line.dealSnapshot } : {}),
    }));

    const deliveryCharge = orderType === "delivery" ? deliveryCharges : 0;
    const finalTotal = total + deliveryCharge;

    // ── Inventory stock check: never send an order that exceeds available stock ──
    if (navigator.onLine) {
      try {
        const stock = await checkStockForOrderItems(orderItems);
        if (!stock.ok) {
          toast.error("Not enough stock for this order", {
            description: stock.shortages.slice(0, 3).join("\n"),
            duration: 8000,
          });
          return;
        }
      } catch (e) {
        console.error("[POS] Stock check failed, allowing order:", e);
      }
    }

    setPaying(true);

    // ── DINE-IN: Print KOT first, then hold the order ──
    if (orderType === "dine_in") {
      const inputData: CreateOrderInput = {
        customerName: nameToUse,
        customerPhone: phoneToUse,
        type: orderType,
        items: orderItems,
        subtotal: originalSubtotal,
        tax: 0,
        deliveryCharge: 0,
        discount,
        total: finalTotal,
        source: "pos",
        paymentMethod: "cash",
        status: "received",
        kitchenStatus: "new",
        createdBy: profile?.id,
        tableNumber,
        ...(orderNotes.trim() ? { deliveryNotes: orderNotes.trim() } : {}),
      };

      try {
        const { order } = buildInstantPosOrder(inputData);
        
        // Print KOT for kitchen
        await printKOT(order);
        
        // Add to hold (for later receipt printing)
        addHoldOrder({
          items: items.map(item => ({ ...item })),
          orderType,
          customerName: nameToUse,
          customerPhone: phoneToUse,
          tableNumber,
          orderNotes: orderNotes.trim(),
          subtotal: originalSubtotal,
          discount,
          total: finalTotal,
        });

        clearOrder();
        setShowDialpad(false);
        setStreet("");
        setCity("Lahore");
        setDeliveryCharges(0);
        setOrderNotes("");
        setPaying(false);
        setCartStep("cart");
        toast.success(`Dine-in order for Table #${tableNumber} sent to kitchen!`, {
          description: "KOT printed. Order is on hold for billing.",
        });
        
        // Refresh stock limits
        getRecipeAvailabilityMap().then(setAvailability).catch(() => {});
      } catch (err: any) {
        toast.error(err?.message || "Failed to print KOT");
        setPaying(false);
      }
      return;
    }

    // ── TAKEAWAY/DELIVERY: Print KOT only (no receipt) ──
    const inputData: CreateOrderInput = {
      customerName: nameToUse,
      customerPhone: phoneToUse,
      type: orderType,
      items: orderItems,
      subtotal: originalSubtotal,
      tax: 0,
      deliveryCharge,
      discount,
      total: finalTotal,
      source: "pos",
      paymentMethod: "cash",
      status: "received",
      kitchenStatus: "new",
      createdBy: profile?.id,
      ...(orderNotes.trim() ? { deliveryNotes: orderNotes.trim() } : {}),
      ...(orderType === "delivery" ? {
        deliveryAddress: { id: "pos-delivery", label: "POS Delivery", street, area: "", city, phone: phoneToUse }
      } : {}),
    };

    try {
      const { order } = buildInstantPosOrder(inputData);
      const num = order.dailyOrderNumber ?? order.orderNumber;

      // Print KOT only (no receipt)
      await printKOT(order);
      
      if (orderType === "delivery") {
        try {
          const { doc: fsDoc, setDoc } = await import("firebase/firestore");
          const deliveryRef = fsDoc(getFirestoreDb(), "deliveries", order.id);
          await setDoc(deliveryRef, {
            orderId: order.id, orderNumber: num, customerName: nameToUse, customerPhone: phoneToUse,
            address: `${street}, ${city}`, deliveryCharge, total: finalTotal, createdAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error("Failed to save delivery order info globally:", e);
        }
      }
      
      clearOrder();
      setShowDialpad(false);
      setStreet("");
      setCity("Lahore");
      setDeliveryCharges(0);
      setOrderNotes("");
      setPaying(false);
      setCartStep("cart");
      toast.success(`Order #${num} sent to kitchen!`, {
        description: "KOT printed for kitchen",
      });
      
      // Refresh stock limits (sync worker deducts inventory in the background)
      getRecipeAvailabilityMap().then(setAvailability).catch(() => {});
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit order");
      setPaying(false);
    }
  }, [
    paying, items, customerName, customerPhone, orderType, subtotal, discount, total,
    tableNumber, profile, street, city, deliveryCharges, orderNotes, savedCustomers, occupiedTables, 
    clearOrder, originalSubtotal, addHoldOrder,
  ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        if (cartStep === "cart") {
          if (items.length > 0) {
            setCartStep("details");
          } else {
            toast.error("Tap items to add to cart");
          }
        } else {
          placeOrder();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [placeOrder, cartStep, items.length]);

  // Compute deal total price for display
  const getDealTotal = (deal: Deal) => {
    const dealItems = menu.filter((m) => deal.menuItemIds?.includes(m.id));
    const rawTotal = dealItems.reduce((sum, item) => {
      const custom = deal.itemPrices?.[item.id];
      const qty = deal.itemQuantities?.[item.id] ?? 1;
      const price = custom !== undefined
        ? custom
        : item.price + (deal.selectedVariants?.[item.id] ? (item.variants?.find((v) => v.id === deal.selectedVariants?.[item.id])?.priceModifier ?? 0) : 0);
      return sum + price * qty;
    }, 0);
    return deal.discountPercent
      ? Math.round(rawTotal * (1 - deal.discountPercent / 100))
      : (deal.fixedPrice ?? rawTotal);
  };

  // Deal card renderer — shared by the Deals tab grid and search results
  const renderDealCard = (deal: Deal) => {
    const dealTotal = getDealTotal(deal);
    const dealItems = menu.filter((m) => deal.menuItemIds?.includes(m.id));
    return (
      <div key={deal.id}
        className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-amber-200/60 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-amber-400/50"
        style={{ height: "235px" }}>
        {/* Deal header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-white/80" />
              <span className="text-sm font-black text-white truncate">{deal.title}</span>
            </div>
            {deal.discountPercent && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black text-white shrink-0">
                {deal.discountPercent}% OFF
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-white/80 line-clamp-1">{deal.description}</p>
        </div>

        {/* Items preview */}
        {dealItems.length > 0 && (
          <div className="flex flex-1 gap-1.5 overflow-x-auto px-3 py-2 items-center [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dealItems.map((item) => {
              const qty = deal.itemQuantities?.[item.id] ?? 1;
              return (
                <div key={item.id} className="flex-shrink-0 flex flex-col items-center">
                  <div className="h-10 w-10 overflow-hidden rounded-lg bg-stone-100 relative">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center text-lg">🍔</div>}
                    {qty > 1 && (
                      <span className="absolute top-0 right-0 bg-primary text-white text-[8px] font-black px-1 rounded-bl">
                        {qty}x
                      </span>
                    )}
                  </div>
                  <span className="mt-0.5 max-w-[44px] truncate text-[8px] text-stone-500 text-center">
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Add button with TOTAL price */}
        <button type="button"
          className="mt-auto shrink-0 flex items-center justify-between bg-amber-50 px-4 py-3 hover:bg-amber-100 active:bg-amber-200 transition border-t border-amber-100"
          onClick={() => {
            addDeal(deal, menu);
            toast.success(`"${deal.title}" added to cart`);
          }}
        >
          <div className="flex flex-col items-start">
            <span className="text-base font-black text-amber-700">{formatCurrency(dealTotal)}</span>
            <span className="text-[10px] text-amber-500 font-semibold">Total deal price</span>
          </div>
          <span className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-white shadow-sm hover:bg-amber-600 active:scale-95 transition">
            <Plus className="h-3.5 w-3.5" /> Add Deal
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f8f4ef]">

      {/* ── Top Header ── */}
      <header className="shrink-0 border-b border-stone-200/80 bg-white/90 px-3 py-2 backdrop-blur-md sm:px-4">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-600 transition hover:bg-stone-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black text-stone-900 sm:text-lg">{RESTAURANT.name}</h1>
            <p className="flex items-center gap-1 text-[10px] text-stone-500">
              <Sparkles className="h-2.5 w-2.5 text-primary" /> Point of Sale
            </p>
          </div>
          
          {/* View Toggle: Menu / Hold Orders */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setActiveView("menu")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm",
                activeView === "menu"
                  ? "bg-primary text-white shadow-md"
                  : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
              )}
            >
              Menu
            </button>
            <button
              onClick={() => setActiveView("hold")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm",
                activeView === "hold"
                  ? "bg-amber-500 text-white shadow-md"
                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
              )}
            >
              Hold Orders
              {holdOrders.length > 0 && (
                <span className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-black px-1.5",
                  activeView === "hold" ? "bg-white/30 text-white" : "bg-amber-500 text-white"
                )}>
                  {holdOrders.length}
                </span>
              )}
            </button>
          </div>
          
          <OfflineIndicator className="shrink-0" />
        </div>

        {/* Categories + Deals tab - only show in menu view */}
        {activeView === "menu" && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button type="button" onClick={() => { setActiveCategory("all"); setSearch(""); }}
              className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition",
                activeCategory === "all" ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
              )}>All</button>

            {/* Deals tab — shown first, highlighted */}
            {deals.length > 0 && (
              <button type="button" onClick={() => { setActiveCategory(DEALS_CATEGORY_ID); setSearch(""); }}
                className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition flex items-center gap-1",
                  activeCategory === DEALS_CATEGORY_ID
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                    : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
                )}>
                <Tag className="h-3 w-3" /> Deals
                <span className={cn("flex h-3.5 min-w-3.5 items-center justify-center rounded-full text-[8px] font-black px-1",
                  activeCategory === DEALS_CATEGORY_ID ? "bg-white/30 text-white" : "bg-amber-200 text-amber-800"
                )}>{deals.length}</span>
              </button>
            )}

            {categories.map((cat) => (
              <button key={cat.id} type="button" onClick={() => { setActiveCategory(cat.id); setSearch(""); }}
                className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition",
                  activeCategory === cat.id ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
                )}>
                {CATEGORY_LABEL[cat.id] ?? cat.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── Main Split Layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden" style={{ height: "calc(100% - 120px)", maxHeight: "calc(100% - 120px)" }}>

        {/* ── LEFT: Menu Grid OR Hold Orders (60%) ── */}
        <main className="flex flex-col overflow-hidden" style={{ width: "60%" }}>
          {activeView === "menu" ? (
            <>
              {/* Search */}
              <div className="shrink-0 p-2 sm:p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <Input
                    className="h-10 rounded-xl border-0 bg-white pl-10 text-sm shadow-sm ring-1 ring-stone-200/80"
                    placeholder={isDealsTab ? "Search deals..." : "Search menu & deals..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Deals Grid */}
              {isDealsTab ? (
                <div className="grid grid-cols-1 gap-2.5 overflow-y-auto px-2 pb-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredDeals.map(renderDealCard)}
                  {filteredDeals.length === 0 && (
                    <p className="col-span-full py-12 text-center text-stone-400">No deals found</p>
                  )}
                </div>
              ) : (
                /* Regular Menu Grid */
                <div className="grid grid-cols-2 gap-2.5 overflow-y-auto px-2 pb-3 sm:grid-cols-3 sm:px-3 lg:grid-cols-4">
                  {searchDeals.length > 0 && (
                    <div className="col-span-full">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-600">
                        <Tag className="h-3.5 w-3.5" /> Matching Deals
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">{searchDeals.length}</span>
                      </p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {searchDeals.map(renderDealCard)}
                      </div>
                    </div>
                  )}
                  {menuLoading ? (
                    <div className="col-span-full p-2"><FoodGridSkeleton count={8} /></div>
                  ) : filtered.map((item) => (
                    <div key={item.id}
                      className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200/60 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/40"
                      style={{ height: "190px" }}
                    >
                      <button
                        type="button"
                        className="relative flex-1 w-full overflow-hidden bg-stone-100 active:scale-[0.98] transition"
                        onClick={() => {
                          const custom = item.variants?.length ? { variantId: item.variants[0].id, variantName: item.variants[0].name } : {};
                          tryAddPosItem(item, custom);
                        }}
                      >
                        <MenuItemImage src={item.imageUrl} alt={item.name} fill />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-xs font-black text-white drop-shadow">{item.name}</span>
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow opacity-0 transition group-hover:opacity-100 active:scale-90">
                          <Plus className="h-3 w-3" />
                        </span>
                      </button>
                      {item.variants && item.variants.length > 0 ? (
                        <div className="flex shrink-0 items-center gap-1 bg-stone-50 p-1.5" style={{ height: "44px" }}>
                          {item.variants.map((v) => (
                            <button key={v.id} type="button"
                              onClick={() => tryAddPosItem(item, { variantId: v.id, variantName: v.name })}
                              className="flex-1 rounded-lg bg-white py-1 text-[10px] font-black text-stone-700 ring-1 ring-stone-200 hover:bg-primary hover:text-white hover:ring-primary active:scale-95 transition"
                            >{v.name}</button>
                          ))}
                        </div>
                      ) : (
                        <button type="button"
                          className="flex shrink-0 items-center justify-between bg-white px-2.5 py-1.5 hover:bg-orange-50 active:bg-stone-50 transition"
                          style={{ height: "44px" }}
                          onClick={() => tryAddPosItem(item)}
                        >
                          <span className="text-xs font-black text-primary">{formatCurrency(item.price)}</span>
                          <span className="rounded-lg bg-orange-50 border border-orange-100 px-1.5 py-0.5 text-[10px] font-black text-orange-700">+ Add</span>
                        </button>
                      )}
                    </div>
                  ))}
                  {!menuLoading && !filtered.length && searchDeals.length === 0 && (
                    <div className="col-span-full flex flex-col items-center gap-2 py-12 text-center">
                      {!navigator.onLine ? (
                        <>
                          <p className="text-2xl">📡</p>
                          <p className="font-bold text-stone-600">No internet connection</p>
                          <p className="text-sm text-stone-400">Load the POS once with internet to cache the menu for offline use</p>
                        </>
                      ) : (
                        <p className="text-stone-400">No items found</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* HOLD ORDERS VIEW */
            <div className="flex flex-col h-full overflow-hidden">
              <div className="shrink-0 p-4 border-b border-stone-100 bg-amber-50/30">
                <h2 className="text-lg font-black text-amber-900 flex items-center gap-2">
                  <Utensils className="h-5 w-5" /> Hold Orders
                </h2>
                <p className="text-xs text-amber-600 mt-0.5">
                  {holdOrders.length} {holdOrders.length === 1 ? "order" : "orders"} on hold
                </p>
              </div>

              {holdOrders.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-100">
                    <Utensils className="h-9 w-9 text-amber-300" />
                  </div>
                  <p className="font-black text-amber-400 text-base">No orders on hold</p>
                  <p className="mt-1 text-sm text-amber-300">Dine-in orders will appear here</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {holdOrders.map((holdOrder) => (
                    <div key={holdOrder.id} className="bg-white rounded-2xl border-2 border-amber-200/60 shadow-sm overflow-hidden">
                      {/* Hold Order Header */}
                      <div className="bg-amber-50 px-4 py-3 border-b border-amber-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                              <Utensils className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-amber-900">
                                Table #{holdOrder.tableNumber}
                              </p>
                              <p className="text-xs text-amber-600">
                                {holdOrder.items.length} {holdOrder.items.length === 1 ? "item" : "items"} • {formatCurrency(holdOrder.total)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`Remove Table #${holdOrder.tableNumber} from hold?`)) {
                                removeHoldOrder(holdOrder.id);
                                toast.success("Order removed from hold");
                              }
                            }}
                            className="text-red-400 hover:text-red-600 transition"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      {/* Hold Order Items */}
                      <div className="p-3 space-y-2">
                        {holdOrder.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-stone-50">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-white">
                              {item.isDeal ? (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 text-xl">🎁</div>
                              ) : (
                                <MenuItemImage src={item.menuItem.imageUrl} alt="" fill />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-stone-900 truncate">
                                {item.quantity}× {item.menuItem.name}
                              </p>
                              <p className="text-xs text-stone-500">{formatCurrency(item.subtotal)}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Hold Order Actions */}
                      <div className="grid grid-cols-2 gap-2 p-3 border-t border-stone-100">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs font-bold"
                          onClick={() => loadHoldOrderForEdit(holdOrder)}
                        >
                          Edit Order
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs font-bold"
                          onClick={() => printHoldReceipt(holdOrder)}
                        >
                          Print Receipt
                        </Button>
                      </div>
                      
                      <div className="px-3 pb-3">
                        <Button
                          size="sm"
                          className="w-full font-bold bg-amber-500 hover:bg-amber-600"
                          onClick={() => sendHoldOrderToKitchen(holdOrder)}
                        >
                          Print Receipt & Complete Order
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── RIGHT: Cart Sidebar (40%) ── */}
        <aside
          className="flex flex-col h-full overflow-hidden bg-white border-l-2 border-stone-200 shadow-[-4px_0_20px_rgba(0,0,0,0.06)]"
          style={{ width: "40%", minWidth: "360px" }}
        >
          {cartStep === "cart" ? (
            <>
              {/* Cart Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 bg-stone-50/60 shrink-0">
                <span className="text-xs font-black uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary" /> Order Cart
                  {items.length > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-white px-1">
                      {items.length}
                    </span>
                  )}
                </span>
                {items.length > 0 && (
                  <button type="button" onClick={() => clearOrder()}
                    className="text-[10px] font-bold text-red-400 hover:text-red-600 transition flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Clear all
                  </button>
                )}
              </div>

              {/* Cart Items (scrollable) */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex h-full min-h-[180px] flex-col items-center justify-center p-6 text-center">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-stone-100">
                      <ShoppingBag className="h-7 w-7 text-stone-300" />
                    </div>
                    <p className="font-black text-stone-400 text-sm">Cart is empty</p>
                    <p className="mt-0.5 text-xs text-stone-300">Tap a product to add it</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {items.map((line) => (
                      <li key={line.id} className="px-3 py-2.5 hover:bg-stone-50/80 transition-colors">
                        {/* Item row */}
                        <div className="flex items-center gap-2.5">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-stone-100 bg-stone-50">
                            {line.isDeal
                              ? <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 text-xl">🎁</div>
                              : <MenuItemImage src={line.menuItem.imageUrl} alt="" fill />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-stone-900 leading-tight">
                              {line.menuItem.name}
                              {line.isDeal && (
                                <span className="ml-1 text-[10px] font-black text-amber-600 bg-amber-50 rounded px-1 border border-amber-200">DEAL</span>
                              )}
                              {!line.isDeal && line.customization?.variantName && (
                                <span className="ml-1 text-[10px] font-semibold text-stone-400 bg-stone-100 rounded px-1">
                                  {line.customization.variantName}
                                </span>
                              )}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              {/* For deals, always show total; for items, show subtotal */}
                              <span className="text-sm font-black text-primary">{formatCurrency(line.subtotal)}</span>
                              {!line.isDeal && line.discountAmount ? (
                                <span className="text-[10px] font-bold text-stone-400 line-through">{formatCurrency(line.unitPrice * line.quantity)}</span>
                              ) : !line.isDeal ? (
                                <span className="text-[10px] text-stone-400">{formatCurrency(line.unitPrice)} ea</span>
                              ) : (
                                <span className="text-[10px] text-amber-500 font-semibold">deal price</span>
                              )}
                            </div>
                          </div>
                          {/* Qty */}
                          <div className="flex items-center gap-0.5 rounded-xl bg-stone-100 p-0.5">
                            <button type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-stone-700 shadow-sm active:scale-90 transition hover:bg-stone-50"
                              onClick={() => updateQty(line.id, Math.max(1, line.quantity - 1))}>
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-black text-stone-900">{line.quantity}</span>
                            <button type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm active:scale-90 transition"
                              onClick={() => {
                                if (!line.isDeal) {
                                  const max = getMaxOrderable(availability, line.menuItem.id, line.customization?.variantId);
                                  if (max !== undefined && getPosInCartQty(line.menuItem.id) >= max) {
                                    toast.error(`Only ${max} × ${line.menuItem.name} can be ordered (stock limit)`);
                                    return;
                                  }
                                }
                                updateQty(line.id, line.quantity + 1);
                              }}>
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {/* Remove */}
                          <button type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 active:scale-90 transition"
                            onClick={() => removeItem(line.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Per-item Discount — only for non-deal items */}
                        {!line.isDeal && (
                          <div className="mt-1.5 flex items-center justify-between gap-2 pl-[66px]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Disc</span>
                            <div className="flex items-center gap-1">
                              {/* Type toggle */}
                              <div className="flex rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
                                <button type="button"
                                  onClick={() => { const { updateLineDiscount } = usePOSStore.getState(); updateLineDiscount(line.id, "percent", line.discountValue ?? 0); }}
                                  className={cn("px-2.5 py-1 text-[10px] font-black transition-all",
                                    line.discountType === "percent" ? "bg-primary text-white" : "text-stone-400 hover:text-stone-600"
                                  )}>%</button>
                                <button type="button"
                                  onClick={() => { const { updateLineDiscount } = usePOSStore.getState(); updateLineDiscount(line.id, "cash", line.discountValue ?? 0); }}
                                  className={cn("px-2.5 py-1 text-[10px] font-black transition-all",
                                    line.discountType === "cash" ? "bg-primary text-white" : "text-stone-400 hover:text-stone-600"
                                  )}>Rs</button>
                              </div>
                              {/* Value input */}
                              <input
                                type="number" min="0" value={line.discountValue || ""} placeholder="0"
                                onChange={(e) => {
                                  const { updateLineDiscount } = usePOSStore.getState();
                                  let val = parseInt(e.target.value) || 0;
                                  if (line.discountType === "percent") val = Math.min(100, Math.max(0, val));
                                  else val = Math.min(line.unitPrice, Math.max(0, val));
                                  updateLineDiscount(line.id, line.discountType || "percent", val);
                                }}
                                className="w-16 h-7 text-right px-2 font-bold rounded-lg border border-stone-200 bg-white text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Pay Bar - Step 1 */}
              <div className="shrink-0 border-t bg-white px-4 py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
                {items.length > 0 && (
                  <div className="mb-2.5 space-y-0.5 rounded-xl bg-stone-50 px-3 py-2.5 border border-stone-100 text-xs">
                    <div className="flex justify-between text-stone-500">
                      <span>Subtotal</span>
                      <span className="font-semibold">{formatCurrency(originalSubtotal)}</span>
                    </div>
                    {totalItemDiscounts > 0 && (
                      <div className="flex justify-between font-bold text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(totalItemDiscounts)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-stone-200 pt-1.5 font-black text-stone-900 text-sm">
                      <span>Total</span>
                      <span className="text-primary">{formatCurrency(total)}</span>
                    </div>
                  </div>
                )}
                <Button size="lg" disabled={!items.length}
                  className="h-12 w-full rounded-2xl text-sm font-bold shadow-lg shadow-primary/25"
                  onClick={() => setCartStep("details")}>
                  Next (Add Details) →
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Back Header */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-stone-100 bg-stone-50/60 shrink-0">
                <button type="button" onClick={() => setCartStep("cart")}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-stone-600 shadow-sm border border-stone-200/80 hover:bg-stone-50 transition active:scale-95">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-black text-stone-800">Order Details</span>
                  <p className="text-[9px] text-stone-400 font-semibold">{items.length} items selected</p>
                </div>
              </div>

              {/* Order Details Body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
                {/* Order Type Selector */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-600">Order Type *</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ORDER_TYPES.map((t) => (
                      <button key={t.id} type="button" onClick={() => setOrderType(t.id)}
                        className={cn("rounded-xl py-3 text-sm font-bold transition-all",
                          orderType === t.id ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        )}>
                        <span className="mr-1">{t.icon}</span>{t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-850 border-t pt-4">
                  <User className="h-3.5 w-3.5" /> Customer Info
                  {orderType === "delivery" && <span className="text-red-500 font-black text-[10px]">* required</span>}
                </p>

                {/* Name + Phone */}
                <div className="grid gap-3 grid-cols-1">
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <Input className="h-12 rounded-xl border-stone-200 bg-white text-sm"
                      style={{ paddingLeft: "2.5rem" }}
                      placeholder={orderType === "delivery" ? "Name *" : "Name (optional)"}
                      value={customerName}
                      onChange={(e) => setCustomer(e.target.value, customerPhone)}
                    />
                  </div>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <Input className="h-12 rounded-xl border-stone-200 bg-white text-sm"
                      style={{ paddingLeft: "2.5rem" }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder={orderType === "delivery" ? "Phone *" : "Phone (optional)"}
                      value={customerPhone}
                      onChange={(e) => {
                        const val = normalizePhone(e.target.value);
                        setCustomer(customerName, val);
                        if (val.length >= 2) {
                          setPhoneSuggestions(savedCustomers.filter((c) => c.phone.toLowerCase().includes(val.toLowerCase())));
                        } else {
                          setPhoneSuggestions([]);
                        }
                      }}
                    />
                    {phoneSuggestions.length > 0 && (
                      <ul className="absolute left-0 right-0 top-13 z-50 max-h-40 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl">
                        {phoneSuggestions.map((s, idx) => (
                          <li key={idx}>
                            <button type="button" onClick={() => selectSuggestion(s)}
                              className="w-full px-3 py-2.5 text-left text-xs text-stone-800 hover:bg-stone-50 border-b border-stone-50 font-bold flex flex-col">
                              <span>📞 {s.phone}</span>
                              <span className="text-stone-400 font-normal text-[10px]">{s.name} - {s.street}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Order Description / Notes */}
                <div className="space-y-1.5">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-600">
                    <Tag className="h-3.5 w-3.5 text-amber-500" /> Order Description / Notes
                  </p>
                  <Textarea
                    className="min-h-[70px] rounded-xl border-stone-200 bg-white text-sm"
                    placeholder="e.g. Extra spicy, no onions, birthday candles... (optional)"
                    value={orderNotes}
                    maxLength={200}
                    onChange={(e) => setOrderNotes(e.target.value)}
                  />
                </div>

                {/* Delivery Address */}
                {orderType === "delivery" && (
                  <div className="space-y-3 border-t pt-4 border-stone-100">
                    <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-orange-850">
                      <MapPin className="h-3 w-3" /> Delivery Address
                    </p>
                    <Input className="h-12 rounded-xl border-stone-200 bg-white text-sm" placeholder="Street / House No. / Address *"
                      value={street} onChange={(e) => setStreet(e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                      <Input className="h-12 rounded-xl border-stone-200 bg-stone-100 text-sm font-bold" placeholder="City *"
                        value={city} readOnly />
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-xs font-extrabold text-stone-400">Rs.</span>
                        <Input type="number" min="0" className="h-12 rounded-xl border-stone-200 bg-white text-sm font-black text-primary"
                          style={{ paddingLeft: "2.25rem" }}
                          placeholder="Charges" value={deliveryCharges || ""}
                          onChange={(e) => setDeliveryCharges(Math.max(0, parseInt(e.target.value) || 0))} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Dine-in Table selector */}
                {orderType === "dine_in" && (
                  <div className="border-t pt-4 border-stone-100 mb-10">
                    <button type="button" onClick={() => setShowDialpad(true)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-sm font-bold hover:opacity-90 transition",
                        tableNumber != null && occupiedTables.includes(tableNumber)
                          ? "bg-red-50 border-red-200 text-red-700"
                          : "bg-orange-50/70 border-orange-100/70 text-orange-900/80"
                      )}>
                      <span className="flex items-center gap-2 uppercase tracking-wider">
                        <Utensils className="h-4 w-4" />
                        Table: {tableNumber != null ? `#${tableNumber}` : "Select Table *"}
                      </span>
                      <span className="text-xs font-black opacity-60">▼ Tap</span>
                    </button>
                    {tableNumber != null && occupiedTables.includes(tableNumber) && (
                      <div className="text-xs font-bold text-red-600 bg-red-50/60 p-2.5 rounded-xl border border-red-100/40">
                        ⚠️ Table #{tableNumber} is already occupied!
                      </div>
                    )}
                    {occupiedTables.length > 0 && (
                      <div className="text-[10px] font-bold text-stone-400 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                        Occupied: {occupiedTables.sort((a, b) => a - b).map((t) => `#${t}`).join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pay Bar - Step 2 */}
              <div className="shrink-0 border-t bg-white px-5 py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
                <div className="mb-3 space-y-1 rounded-xl bg-stone-50 px-4 py-3 border border-stone-100 text-sm">
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal</span>
                    <span className="font-semibold">{formatCurrency(originalSubtotal)}</span>
                  </div>
                  {totalItemDiscounts > 0 && (
                    <div className="flex justify-between font-bold text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(totalItemDiscounts)}</span>
                    </div>
                  )}
                  {orderType === "delivery" && (
                    <div className="flex justify-between text-stone-500">
                      <span>Delivery</span>
                      <span className="font-semibold">{formatCurrency(deliveryCharges)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-stone-200 pt-2 font-black text-stone-900 text-base">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(total + (orderType === "delivery" ? deliveryCharges : 0))}</span>
                  </div>
                </div>
                <Button size="lg" disabled={paying || !items.length}
                  className="h-14 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/25"
                  onClick={placeOrder}>
                  {paying ? "Processing..." : `Print Order · F2`}
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Table Dialpad Modal */}
      {showDialpad && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <Utensils className="h-4 w-4 text-primary" /> Select Dine-in Table
              </h3>
              <button type="button" onClick={() => setShowDialpad(false)} className="text-xs font-bold text-stone-400 hover:text-stone-700">✕ Close</button>
            </div>
            <div className="text-center bg-stone-50 py-4 rounded-2xl border border-stone-100">
              <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Selected Table</span>
              <p className="text-4xl font-black text-primary mt-1">{tableNumber != null ? `#${tableNumber}` : "—"}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "back"].map((k) => {
                const num = k === "back" || k === "C" ? null : Number(k);
                const isOccupied = num !== null && occupiedTables.includes(num);
                return (
                  <button key={k} type="button" onClick={() => handleDialpadPress(k)}
                    className={cn("flex h-14 items-center justify-center rounded-2xl text-lg font-black shadow-sm active:scale-95 border transition",
                      isOccupied ? "bg-red-50 text-red-500 border-red-200 hover:bg-red-100" : "bg-stone-50 hover:bg-stone-100 border-stone-200/60 text-stone-800"
                    )}>
                    {k === "back" ? "⌫" : k}
                  </button>
                );
              })}
            </div>
            {occupiedTables.length > 0 && (
              <div className="text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-2xl border border-red-100 max-h-24 overflow-y-auto">
                ⚠️ Occupied: {occupiedTables.sort((a, b) => a - b).map((t) => `#${t}`).join(", ")}
              </div>
            )}
            <Button className="w-full h-12 rounded-xl font-bold" onClick={() => setShowDialpad(false)}>
              ✓ Confirm Table
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
