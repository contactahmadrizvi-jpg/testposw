"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { userHasPermission } from "@/lib/permissions";
import RiderDashboard from "@/components/admin/RiderDashboard";
import Link from "next/link";
import { DollarSign, ShoppingBag, AlertTriangle, TrendingUp, Clock, Printer, Edit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { printReceipt } from "@/lib/print";
import { toast } from "sonner";
import { ORDER_STATUS_LABELS } from "@/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePicker } from "@/components/ui/date-picker";
import { getPendingKitchenOrders } from "@/lib/pos-instant";
import { getRevenueByHour } from "@/services/analytics.service";
import { subscribeOrders } from "@/services/orders.service";
import { getLowStockItems } from "@/services/inventory.service";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  getCurrentBusinessDate,
  getBusinessDayRange,
  getBusinessDateForOrder,
} from "@/lib/business-hours";

const COLORS = ["#dc2f02", "#e85d04", "#f48c06", "#2d6a4f"];

function getRevenueByDay(orders: any[]) {
  const daysMap: Record<string, { label: string; dateVal: number; revenue: number }> = {};
  orders.forEach((o) => {
    if (o.status === "cancelled") return;
    // Exclude credit sales from collected revenue
    if (o.paymentMethod === "credit" || o.paymentStatus === "credit") return;
    const bizDate = getBusinessDateForOrder(o.createdAt);
    const [year, month, day] = bizDate.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const key = d.toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
    if (!daysMap[bizDate]) {
      daysMap[bizDate] = { label: key, dateVal: d.getTime(), revenue: 0 };
    }
    daysMap[bizDate].revenue += o.total;
  });
  return Object.values(daysMap)
    .sort((a, b) => a.dateVal - b.dateVal)
    .map((item) => ({ day: item.label, revenue: item.revenue }));
}

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [hourData, setHourData] = useState<{ hour?: string; day?: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [localTrigger, setLocalTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<"day" | "this_month" | "prev_month" | "custom">("day");

  // Date selection state: defaults to current active business shift date (1 PM to 3 AM)
  const [selectedDate, setSelectedDate] = useState(() => getCurrentBusinessDate());
  
  // Custom date range state
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; // First day of month
  });
  
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    // Load cached data instantly
    const cacheKey = viewMode === "custom" 
      ? `admin_dashboard_orders_${fromDate}_${toDate}`
      : `admin_dashboard_orders_${selectedDate}`;
    const cachedOrders = localStorage.getItem(cacheKey);
    
    if (cachedOrders) {
      try {
        const parsed = JSON.parse(cachedOrders);
        setOrders(parsed);
        if (viewMode === "day") {
          setHourData(getRevenueByHour(parsed));
        } else {
          setHourData(getRevenueByDay(parsed) as any);
        }
        setLoading(false); // Show cached data immediately
      } catch (e) {
        console.error('Cache parse error:', e);
      }
    }

    const onPending = () => setLocalTrigger((prev) => prev + 1);
    window.addEventListener("rush-pos-pending", onPending);
    window.addEventListener("storage", onPending);
    return () => {
      window.removeEventListener("rush-pos-pending", onPending);
      window.removeEventListener("storage", onPending);
    };
  }, []);

  useEffect(() => {
    setLoading(true);

    let start: Date;
    let end: Date;

    if (viewMode === "this_month") {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1, 13, 0, 0, 0);
      // End at 3:00 AM on the 1st of next month to capture last day's night shift
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 3, 0, 0, 0);
    } else if (viewMode === "prev_month") {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 13, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 1, 3, 0, 0, 0);
    } else if (viewMode === "custom") {
      const [fromY, fromM, fromD] = fromDate.split("-").map(Number);
      const [toY, toM, toD] = toDate.split("-").map(Number);
      start = new Date(fromY, fromM - 1, fromD, 13, 0, 0, 0);
      end = new Date(toY, toM - 1, toD + 1, 3, 0, 0, 0);
    } else {
      // 1 day operational shift: 1:00 PM on selectedDate to 3:00 AM next day
      const range = getBusinessDayRange(selectedDate);
      start = range.start;
      end = range.end;
    }

    // Subscribe to selected range orders
    const unsub = subscribeOrders((list) => {
      const pendingLocal = getPendingKitchenOrders();
      const syncedIds = new Set(list.map((o) => o.id));
      const localOnly = pendingLocal.filter((p) => !syncedIds.has(p.id));

      const isTodaySelected = () => {
        return selectedDate === getCurrentBusinessDate() && viewMode === "day";
      };

      const finalLocal = isTodaySelected() ? localOnly : [];
      const merged = [...finalLocal, ...list];

      setOrders(merged);
      
      // Cache orders for instant load next time
      const cacheKey = viewMode === "custom" 
        ? `admin_dashboard_orders_${fromDate}_${toDate}`
        : `admin_dashboard_orders_${selectedDate}`;
      localStorage.setItem(cacheKey, JSON.stringify(merged));

      if (viewMode === "day") {
        setHourData(getRevenueByHour(merged));
      } else {
        setHourData(getRevenueByDay(merged) as any);
      }
      setLoading(false);
    }, start.toISOString(), end.toISOString());

    // Fetch low stock items count (async, non-blocking)
    getLowStockItems().then(items => setLowStockCount(items.length)).catch(() => setLowStockCount(0));

    return () => unsub();
  }, [selectedDate, viewMode, localTrigger, fromDate, toDate]);

  if (loading) return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  // Compute dashboard metrics dynamically from loaded orders
  // Exclude credit orders from collected revenue (credit = unpaid debt, not actual income)
  const todayRevenue = orders
    .filter((o) => o.status !== "cancelled" && o.paymentMethod !== "credit" && o.paymentStatus !== "credit")
    .reduce((sum, o) => sum + o.total, 0);

  const creditOutstanding = orders
    .filter((o) => o.status !== "cancelled" && (o.paymentMethod === "credit" || o.paymentStatus === "credit"))
    .reduce((sum, o) => sum + o.total, 0);

  const pendingOrders = orders.filter(
    (o) => !["delivered", "served", "cancelled"].includes(o.status)
  ).length;

  const onlinePayments = orders
    .filter((o) => o.paymentMethod === "online" && o.paymentStatus === "paid")
    .reduce((sum, o) => sum + o.total, 0);

  const cashPayments = orders
    .filter((o) => o.paymentMethod === "cash")
    .reduce((sum, o) => sum + o.total, 0);

  const cardPayments = orders
    .filter((o) => o.paymentMethod === "card")
    .reduce((sum, o) => sum + o.total, 0);

  const pendingOrdersList = orders.filter(
    (o) => !["delivered", "served", "cancelled"].includes(o.status)
  );

  async function handlePrintReceipt(order: any) {
    try {
      toast.success(`Printing receipt for Order #${order.dailyOrderNumber ?? order.orderNumber}...`);
      await printReceipt(order);
    } catch {
      toast.error("Failed to print receipt");
    }
  }

  const cards = [
    { label: viewMode === "day" ? "Collected Revenue" : "Collected Revenue", value: formatCurrency(todayRevenue), icon: DollarSign },
    { label: viewMode === "day" ? "Selected Date Orders" : "Selected Period Orders", value: String(orders.filter(o => o.status !== "cancelled").length), icon: ShoppingBag, href: "/admin/orders" },
    { label: "Pending Orders Count", value: String(pendingOrdersList.length), icon: TrendingUp, href: "/admin/orders?tab=pending" },
    { label: "Low Stock Alert Items", value: String(lowStockCount), icon: AlertTriangle, href: "/admin/inventory" },
  ];

  const paymentData = [
    { name: "Cash", value: cashPayments },
    { name: "Online", value: onlinePayments },
    { name: "Card", value: cardPayments },
  ].filter(p => p.value > 0);

  // If no payment data exists, show dummy/empty structure
  const displayPaymentData = paymentData.length > 0 ? paymentData : [{ name: "No Sales", value: 1 }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-muted-foreground">Select a range or date to view complete statistics and analytics.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            className="rounded-md border bg-background px-3 py-2 text-sm font-semibold"
          >
            <option value="day">Single Day</option>
            <option value="this_month">This Month</option>
            <option value="prev_month">Previous Month</option>
            <option value="custom">Custom Range</option>
          </select>
          {viewMode === "day" && (
            <div className="w-full sm:w-[240px]">
              <DatePicker
                date={selectedDate}
                onDateChange={setSelectedDate}
                placeholder="Select date"
              />
            </div>
          )}
          {viewMode === "custom" && (
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="w-full sm:w-[200px]">
                <DatePicker
                  date={fromDate}
                  onDateChange={setFromDate}
                  placeholder="From date"
                />
              </div>
              <span className="hidden sm:block text-sm font-medium text-muted-foreground">to</span>
              <div className="w-full sm:w-[200px]">
                <DatePicker
                  date={toDate}
                  onDateChange={setToDate}
                  placeholder="To date"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c: any) => {
          const cardContent = (
            <Card key={c.label} className={`shadow-sm transition ${c.href ? "hover:border-primary/50 cursor-pointer" : ""}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{c.label}</CardTitle>
                <c.icon className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent><p className="text-2xl font-black">{c.value}</p></CardContent>
            </Card>
          );
          return c.href ? (
            <Link key={c.label} href={c.href}>
              {cardContent}
            </Link>
          ) : (
            cardContent
          );
        })}
      </div>
      {creditOutstanding > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-red-500">Credit Outstanding (Not Collected)</p>
            <p className="mt-1 text-2xl font-black text-red-600">{formatCurrency(creditOutstanding)}</p>
          </div>
          <p className="text-xs text-red-400 font-semibold max-w-[200px] text-right">This amount is owed by customers on credit — excluded from revenue.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base font-bold">{viewMode === "day" ? "Revenue by Hour" : "Revenue by Day"}</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData}>
                <XAxis dataKey={viewMode === "day" ? "hour" : "day"} fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="#dc2f02" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader><CardTitle className="text-base font-bold">Payments Breakdown</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={displayPaymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {displayPaymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => typeof v === "number" ? formatCurrency(v) : v} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Pending Orders Section with Edit and Print */}
      {pendingOrdersList.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base font-bold">Pending Orders ({pendingOrdersList.length})</CardTitle>
            </div>
            <Link
              href="/admin/orders?tab=pending"
              className="text-xs font-bold text-primary hover:underline"
            >
              View All in Orders Tab →
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingOrdersList.slice(0, 10).map((o) => (
              <div
                key={o.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3.5 transition hover:bg-muted/40"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-stone-900">
                      Order #{o.dailyOrderNumber ?? o.orderNumber}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {ORDER_STATUS_LABELS[o.status] ?? o.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">
                      · {o.type?.replace("_", " ") || "dine in"}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600">
                    {o.customerName || "Customer"}{o.customerPhone ? ` · ${o.customerPhone}` : ""}
                    {o.tableNumber ? ` · Table #${o.tableNumber}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {o.items?.map((item: any) => `${item.quantity}× ${item.name}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <span className="text-base font-black text-primary">
                    {formatCurrency(o.total)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Print Receipt Button */}
                    <button
                      type="button"
                      onClick={() => handlePrintReceipt(o)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition hover:bg-stone-50 active:scale-95"
                      title="Print Receipt"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    {/* Edit Order Button */}
                    <Link
                      href={`/admin/orders?tab=pending&edit=${o.id}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 shadow-sm transition hover:bg-blue-100 active:scale-95"
                      title="Edit Order"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
