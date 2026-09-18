"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Package,
  Users,
  BarChart3,
  Settings,
  Monitor,
  Clock,
  Shield,
  X,
  Tag,
  CreditCard,
  Bike,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { userHasPermission } from "@/lib/permissions";
import { Suspense, useState } from "react";
import { SomoLogo } from "@/components/somo-logo";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const nav = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard", perm: "dashboard" },
  { href: "/admin/orders", icon: ShoppingBag, label: "All Orders", perm: "orders", key: "all-orders" },
  { href: "/admin/orders?tab=pending", icon: Clock, label: "Pending Orders", perm: "orders", key: "pending-orders" },
  { href: "/admin/menu", icon: UtensilsCrossed, label: "Menu", perm: "menu" },
  { href: "/admin/deals", icon: Tag, label: "Deals", perm: "menu" },
  { href: "/admin/inventory", icon: Package, label: "Inventory", perm: "inventory" },
  { href: "/admin/employees", icon: Users, label: "Employees", perm: "employees" },
  { href: "/admin/roles", icon: Shield, label: "Roles", perm: "roles" },
  { href: "/admin/reports", icon: BarChart3, label: "Reports", perm: "reports" },
  { href: "/admin/credits", icon: CreditCard, label: "Credit Sales", perm: "orders" },
  { href: "/admin/deliveries", icon: Bike, label: "Daily Deliveries", perm: "orders" },
  { href: "/pos-kitchen", icon: Monitor, label: "POS & Kitchen", perm: "pos_kitchen" },
  { href: "/admin/settings", icon: Settings, label: "Settings", perm: "settings" },
];

function NavLinksContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);
  const currentTab = searchParams.get("tab");
  const [showSignoutDialog, setShowSignoutDialog] = useState(false);

  const visible = nav.filter((item) => {
    if (item.perm === "orders") {
      return (
        userHasPermission(profile, "orders") ||
        userHasPermission(profile, "online_orders")
      );
    }
    if (item.perm === "pos_kitchen") {
      return (
        userHasPermission(profile, "pos") ||
        userHasPermission(profile, "kitchen")
      );
    }
    return userHasPermission(profile, item.perm);
  });

  const handleSignOut = async () => {
    try {
      await logout();
      toast.success("Signed out successfully");
      window.location.href = "/login";
    } catch (error) {
      toast.error("Failed to sign out");
      throw error;
    }
  };

  return (
    <>
      <nav className="flex-1 space-y-1 p-4">
        {visible.map((item) => {
          let active = pathname === item.href;
          if (item.key === "pending-orders") {
            active = pathname === "/admin/orders" && currentTab === "pending";
          } else if (item.key === "all-orders") {
            active = pathname === "/admin/orders" && currentTab !== "pending";
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                active && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign Out Button */}
      <div className="shrink-0 border-t border-border p-4">
        <button
          type="button"
          onClick={() => setShowSignoutDialog(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>

      {/* Signout Confirmation Dialog */}
      <ConfirmDialog
        open={showSignoutDialog}
        onOpenChange={setShowSignoutDialog}
        onConfirm={handleSignOut}
        title="Sign Out?"
        description="Are you sure you want to sign out? You will need to log in again to access the admin panel."
        confirmText="Yes, Sign Out"
        cancelText="Cancel"
        variant="destructive"
      />
    </>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Loading navigation...</div>}>
      <NavLinksContent onNavigate={onNavigate} />
    </Suspense>
  );
}

export function AdminSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="border-b p-6">
        <SomoLogo size="md" showText />
      </div>
      <NavLinks />
    </aside>
  );
}

export function AdminMobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className="absolute left-0 top-0 flex h-full w-[min(85vw,280px)] flex-col bg-card shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <SomoLogo size="sm" showText />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavLinks onNavigate={onClose} />
      </aside>
    </div>
  );
}
