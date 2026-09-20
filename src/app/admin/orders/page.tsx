"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { subscribeOrders, deleteOrder } from "@/services/orders.service";
import { subscribeMenuItems, getActiveDeals } from "@/services/menu.service";
import { getPendingKitchenOrders } from "@/lib/pos-instant";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ORDER_STATUS_LABELS } from "@/constants";
import { useAuthStore } from "@/stores/auth-store";
import { canViewOrders, ordersFilterForUser } from "@/lib/permissions";
import type { Order, MenuItem, MenuVariant, Deal } from "@/types";
import { OrderListSkeleton } from "@/components/ui/loading-skeletons";
import { Trash2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/config";

function AdminOrdersContent() {
  const profile = useAuthStore((s) => s.profile);
  const searchParams = useSearchParams();
  const filter = ordersFilterForUser(profile);
  const isAdminOrManager = profile && ["super_admin", "admin", "manager"].includes(profile.role);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Set tab dynamically based on URL parameter (?tab=pending)
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  // ── Edit order modal state ──
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editedItems, setEditedItems] = useState<Order["items"]>([]);
  const [editedNotes, setEditedNotes] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [isSavingEdited, setIsSavingEdited] = useState(false);

  // Load menu items + deals (used by the edit-order modal)
  useEffect(() => {
    const unsub = subscribeMenuItems((items) => {
      if (items.length > 0) setMenuItems(items);
    });
    getActiveDeals().then(setDeals).catch(console.error);
    return () => unsub();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    setActiveTab(tabParam === "pending" ? "pending" : "all");
  }, [searchParams]);

  useEffect(() => {
    if (filter === "none") {
      setLoading(false);
      return;
    }
    
    // Load cached orders instantly
    const cacheKey = `admin_orders_${selectedDate}_${filter}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setOrders(parsed);
        setLoading(false); // Show cached data immediately
      } catch (e) {
        console.error('Orders cache parse error:', e);
      }
    } else {
      setLoading(true);
    }

    let remoteList: Order[] = [];

    const apply = (remote: Order[]) => {
      let filteredRemote = remote;
      if (filter === "online") {
        filteredRemote = remote.filter((o) => o.source === "website");
      }

      const pendingLocal = getPendingKitchenOrders();
      const syncedIds = new Set(filteredRemote.map((o) => o.id));
      const localOnly = pendingLocal.filter((p) => !syncedIds.has(p.id));

      const isTodaySelected = () => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        return selectedDate === todayStr;
      };

      const finalLocal = isTodaySelected() ? localOnly : [];
      const merged = [...finalLocal, ...filteredRemote].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setOrders(merged);
      setLoading(false);
      
      // Cache the orders
      localStorage.setItem(cacheKey, JSON.stringify(merged));
    };

    const start = new Date(`${selectedDate}T00:00:00`);
    const end = new Date(`${selectedDate}T23:59:59.999`);

    const unsub = subscribeOrders((list) => {
      remoteList = list;
      apply(list);
    }, start.toISOString(), end.toISOString());

    const onPending = () => apply(remoteList);
    window.addEventListener("rush-pos-pending", onPending);
    window.addEventListener("storage", onPending);

    return () => {
      unsub();
      window.removeEventListener("rush-pos-pending", onPending);
      window.removeEventListener("storage", onPending);
    };
  }, [filter, selectedDate]);

  if (!canViewOrders(profile)) {
    return <p className="text-muted-foreground">No access to orders.</p>;
  }

  // ── Edit order handlers ──
  function openEditModal(order: Order) {
    setEditingOrder(order);
    setEditedItems(JSON.parse(JSON.stringify(order.items)));
    setEditedNotes(order.deliveryNotes || "");
    setMenuSearch("");
  }

  function handleUpdateQty(idx: number, delta: number) {
    const next = [...editedItems];
    const item = next[idx]!;
    const newQty = Math.max(1, item.quantity + delta);

    // Recalculate item subtotal
    const unitPrice = item.price;
    item.quantity = newQty;
    item.subtotal = unitPrice * newQty;

    setEditedItems(next);
  }

  function handleRemoveItem(idx: number) {
    setEditedItems(editedItems.filter((_, i) => i !== idx));
  }

  function handleDirectAddMenuItem(menuItem: MenuItem, variant?: MenuVariant) {
    const finalPrice = menuItem.price + (variant ? variant.priceModifier : 0);
    const displayName = variant ? `${menuItem.name} (${variant.name})` : menuItem.name;
    const customization = variant ? { variantId: variant.id, variantName: variant.name } : {};

    // Check if item already exists in edited list with the same customization/variant
    const existingIdx = editedItems.findIndex(
      (i) => i.menuItemId === menuItem.id && JSON.stringify(i.customization || {}) === JSON.stringify(customization)
    );

    if (existingIdx !== -1) {
      handleUpdateQty(existingIdx, 1);
      toast.success(`Added one more ${displayName}`);
      return;
    }

    const newItem: Order["items"][number] = {
      id: `added-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: finalPrice,
      quantity: 1,
      subtotal: finalPrice,
      customization,
    };

    setEditedItems([...editedItems, newItem]);
    toast.success(`Added ${displayName}`);
  }

  function handleAddDeal(deal: Deal) {
    const existingIdx = editedItems.findIndex((i) => i.menuItemId === `deal-${deal.id}`);
    if (existingIdx !== -1) {
      handleUpdateQty(existingIdx, 1);
      toast.success(`Added one more "${deal.title}"`);
      return;
    }

    // Compute deal price
    const dealItems = menuItems.filter((m) => deal.menuItemIds?.includes(m.id));
    const rawTotal = dealItems.reduce((sum, item) => {
      const custom = deal.itemPrices?.[item.id];
      const qty = deal.itemQuantities?.[item.id] ?? 1;
      const price = custom !== undefined
        ? custom
        : item.price + (deal.selectedVariants?.[item.id] ? (item.variants?.find((v) => v.id === deal.selectedVariants?.[item.id])?.priceModifier ?? 0) : 0);
      return sum + price * qty;
    }, 0);
    const dealPrice = deal.discountPercent
      ? Math.round(rawTotal * (1 - deal.discountPercent / 100))
      : (deal.fixedPrice ?? rawTotal);

    const newItem: Order["items"][number] = {
      id: `added-deal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      menuItemId: `deal-${deal.id}`,
      name: deal.title,
      price: dealPrice,
      quantity: 1,
      subtotal: dealPrice,
      customization: {},
      // Snapshot of deal contents at time of adding — used for inventory restoration
      // even if the deal is later deleted or modified in the admin panel
      dealSnapshot: {
        menuItemIds: deal.menuItemIds ?? [],
        itemQuantities: deal.itemQuantities ?? {},
        selectedVariants: (deal.selectedVariants as Record<string, string>) ?? {},
      },
    };

    setEditedItems([...editedItems, newItem]);
    toast.success(`Added deal: ${deal.title}`);
  }

  async function saveEditedOrder() {
    if (!editingOrder) return;
    if (editedItems.length === 0) {
      toast.error("An order must have at least 1 item");
      return;
    }

    setIsSavingEdited(true);
    try {
      const newSubtotal = editedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const newTotal = Math.max(0, newSubtotal - (editingOrder.discount ?? 0) + (editingOrder.tax ?? 0) + (editingOrder.deliveryCharge ?? 0));
      const updatedOrder = {
        ...editingOrder,
        items: editedItems,
        subtotal: newSubtotal,
        total: newTotal,
        deliveryNotes: editedNotes.trim() || undefined,
      };

      const m = await import("@/lib/pos-instant");
      const isLocalPending = m.getPendingPosOrders().some((p) => p.localId === editingOrder.id);

      if (isLocalPending) {
        m.updatePendingOrderItems(editingOrder.id, editedItems, newSubtotal, newTotal, editedNotes.trim());
        toast.success("Local order updated!");
        setEditingOrder(null);
        return;
      }

      // Update inventory stock (restore old order items, deduct new order items)
      try {
        const { restoreInventoryForOrder, deductInventoryForOrder } = await import("@/services/inventory.service");
        await restoreInventoryForOrder(editingOrder.id, editingOrder.items, "admin-edit");
        await deductInventoryForOrder(editingOrder.id, editedItems, "admin-edit");
      } catch (invErr) {
        console.error("Inventory update error:", invErr);
      }

      // Update payment document amount if exists
      try {
        const { getDocs, query, collection, where, updateDoc: updateFsDoc } = await import("firebase/firestore");
        const paymentsRef = collection(getFirestoreDb(), "payments");
        const q = query(paymentsRef, where("orderId", "==", editingOrder.id));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          for (const payDoc of qSnap.docs) {
            await updateFsDoc(payDoc.ref, {
              amount: newTotal,
            });
          }
        }
      } catch (payErr) {
        console.error("Payment update error:", payErr);
      }

      await updateDoc(doc(getFirestoreDb(), "orders", editingOrder.id), {
        items: editedItems,
        subtotal: newSubtotal,
        total: newTotal,
        ...(editedNotes.trim() ? { deliveryNotes: editedNotes.trim() } : { deliveryNotes: deleteField() }),
        updatedAt: new Date().toISOString(),
      });

      toast.success("Order updated successfully!");
      setEditingOrder(null);
    } catch (err) {
      toast.error("Failed to update order");
    } finally {
      setIsSavingEdited(false);
    }
  }

  const isPending = (o: Order) => !["delivered", "served", "cancelled"].includes(o.status);
  const allCount = orders.length;
  const pendingCount = orders.filter(isPending).length;
  const displayedOrders = activeTab === "all" ? orders : orders.filter(isPending);

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Orders</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div className="mt-6">
          <OrderListSkeleton count={5} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{activeTab === "pending" ? "Pending Orders" : "All Orders"}</h1>
          <p className="text-sm text-muted-foreground">{activeTab === "pending" ? `${pendingCount} pending` : `${allCount} total`} for this date</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm font-semibold text-stone-800"
        />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === "all"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All Orders ({allCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Pending Orders ({pendingCount})
        </button>
      </div>

      <div className="mt-6 space-y-4">
        {displayedOrders.map((o) => (
          <div key={o.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-lg text-stone-900">
                  Order #{o.dailyOrderNumber ?? o.orderNumber}
                </p>
                <p className="text-sm text-stone-700">
                  {o.customerName} · {o.customerPhone}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(o.createdAt)}
                </p>
                <p className="mt-1 text-xs capitalize text-muted-foreground">
                  {o.type.replace("_", " ")} · {o.source}
                </p>
                {o.deliveryNotes && (
                  <p className="mt-2 max-w-md rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-bold text-amber-700">
                    📝 {o.deliveryNotes}
                  </p>
                )}
              </div>
              <div className="text-right flex flex-col items-end">
                <Badge>{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                <p className="mt-2 text-xl font-bold text-primary">
                  {formatCurrency(o.total)}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  {/* Delete — admin/manager only */}
                  {isAdminOrManager && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Delete Order #${o.dailyOrderNumber ?? o.orderNumber}? This will restore inventory.`)) {
                          // Optimistic: remove from UI instantly
                          setOrders((prev) => prev.filter((item) => item.id !== o.id));
                          try {
                            await deleteOrder(o.id);
                            toast.success(`Order #${o.dailyOrderNumber ?? o.orderNumber} deleted`);
                          } catch (err: any) {
                            // If Firestore delete failed, put the order back
                            toast.error(err?.message || "Failed to delete order. Check your permissions.");
                          }
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition active:scale-95"
                      title="Delete Order"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <ul className="mt-4 divide-y rounded-lg border bg-muted/30 text-sm">
              {o.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-3 py-2 text-stone-850 font-medium"
                >
                  <span>
                    <span className="font-bold text-stone-900">{item.quantity}×</span> {item.name} {item.customization?.variantName ? `(${item.customization.variantName})` : ""}
                  </span>
                  <span className="shrink-0 font-bold text-stone-900">
                    {formatCurrency(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!displayedOrders.length && (
          <p className="py-12 text-center text-muted-foreground">No orders yet</p>
        )}
      </div>

      {/* ── Edit Order Modal ── */}
      {editingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-slate-900">
                Modify Order #{editingOrder.dailyOrderNumber ?? editingOrder.orderNumber}
              </h3>
              <button
                type="button"
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
                onClick={() => setEditingOrder(null)}
              >
                Cancel
              </button>
            </div>

            {/* Menu Item Addition Selector */}
            <div className="bg-stone-50 p-3.5 rounded-2xl border space-y-2">
              <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">Add Item From Menu</span>
              <Input
                type="text"
                placeholder="🔍 Search food menu & deals..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="h-10 text-xs rounded-xl border bg-white px-3"
              />

              {(() => {
                if (!menuSearch.trim()) return null;
                const queryStr = menuSearch.toLowerCase();
                const matchedItems = menuItems
                  .filter((m) => m.name.toLowerCase().includes(queryStr))
                  .slice(0, 10)
                  .flatMap((m) => {
                    if (m.variants && m.variants.length > 0) {
                      return m.variants.map((v) => ({
                        key: `${m.id}-${v.id}`,
                        label: `${m.name} (${v.name})`,
                        price: m.price + v.priceModifier,
                        onClick: () => handleDirectAddMenuItem(m, v),
                        isDeal: false,
                      }));
                    }
                    return [{
                      key: m.id,
                      label: m.name,
                      price: m.price,
                      onClick: () => handleDirectAddMenuItem(m),
                      isDeal: false,
                    }];
                  });

                const matchedDeals = deals
                  .filter((d) =>
                    d.title.toLowerCase().includes(queryStr) ||
                    (d.description && d.description.toLowerCase().includes(queryStr))
                  )
                  .slice(0, 5)
                  .map((d) => {
                    const dealItems = menuItems.filter((m) => d.menuItemIds?.includes(m.id));
                    const rawTotal = dealItems.reduce((sum, item) => {
                      const custom = d.itemPrices?.[item.id];
                      const qty = d.itemQuantities?.[item.id] ?? 1;
                      const price = custom !== undefined
                        ? custom
                        : item.price + (d.selectedVariants?.[item.id] ? (item.variants?.find((v) => v.id === d.selectedVariants?.[item.id])?.priceModifier ?? 0) : 0);
                      return sum + price * qty;
                    }, 0);
                    const dealPrice = d.discountPercent
                      ? Math.round(rawTotal * (1 - d.discountPercent / 100))
                      : (d.fixedPrice ?? rawTotal);

                    return {
                      key: `deal-${d.id}`,
                      label: `🎁 ${d.title}`,
                      price: dealPrice,
                      onClick: () => handleAddDeal(d),
                      isDeal: true,
                    };
                  });

                const results = [...matchedItems, ...matchedDeals];

                return (
                  <div className="max-h-36 overflow-y-auto border rounded-xl bg-white p-2 grid grid-cols-2 gap-1.5">
                    {results.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={item.onClick}
                        className={cn(
                          "text-left p-2 border rounded-lg text-xs font-bold hover:bg-orange-50 hover:border-primary transition flex flex-col justify-between",
                          item.isDeal ? "border-amber-200 bg-amber-50/20 hover:bg-amber-50" : ""
                        )}
                      >
                        <span className="truncate">{item.label}</span>
                        <span className="text-primary font-black mt-0.5">{item.price.toLocaleString()} PKR</span>
                      </button>
                    ))}
                    {results.length === 0 && (
                      <span className="col-span-2 text-center text-xs text-slate-400 py-4">No matching items</span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Order Description / Notes */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">Order Description / Notes</span>
              <Textarea
                placeholder="Special instructions for this order (printed on KOT & receipt)..."
                value={editedNotes}
                maxLength={200}
                onChange={(e) => setEditedNotes(e.target.value)}
                className="min-h-[60px] text-xs rounded-xl"
              />
            </div>

            {/* Items list */}
            <div className="max-h-[220px] overflow-y-auto space-y-3 pr-1">
              {editedItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between border-b pb-2.5 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.customization?.variantName || "Standard"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="h-7 w-7 rounded bg-slate-100 flex items-center justify-center active:scale-95 border"
                      onClick={() => handleUpdateQty(idx, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center font-bold text-sm">{item.quantity}</span>
                    <button
                      type="button"
                      className="h-7 w-7 rounded bg-slate-800 text-white flex items-center justify-center active:scale-95"
                      onClick={() => handleUpdateQty(idx, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-500 font-extrabold ml-3 active:scale-95"
                      onClick={() => handleRemoveItem(idx)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 border-t pt-4">
              <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setEditingOrder(null)}>
                Discard
              </Button>
              <Button className="flex-1 rounded-xl font-bold" onClick={saveEditedOrder} disabled={isSavingEdited}>
                {isSavingEdited ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div>Loading orders dashboard...</div>}>
      <AdminOrdersContent />
    </Suspense>
  );
}
