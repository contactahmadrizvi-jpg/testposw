"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Menu } from "lucide-react";
import { AdminSidebar, AdminMobileNav } from "@/components/admin/sidebar";
import { useAuthStore, isAdminRole } from "@/stores/auth-store";
import { AdminAuthLoading } from "@/components/ui/page-loader";
import { Button } from "@/components/ui/button";
import { subscribeOrders } from "@/services/orders.service";
import { playOrderSound } from "@/lib/print";
import { toast } from "sonner";
import { userHasPermission } from "@/lib/permissions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading, firebaseUser, refreshProfile } = useAuthStore();
  const [checked, setChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const lastAlertRef = useRef(new Date().toISOString());

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login?redirect=/admin");
      return;
    }
    setChecked(true);
  }, [firebaseUser, loading, router]);

  // Redirect non-admin users away from dashboard if they don't have permission
  useEffect(() => {
    if (!profile || loading) return;
    
    // If on dashboard page and user doesn't have dashboard permission, redirect to first allowed page
    if (pathname === "/admin" && !userHasPermission(profile, "dashboard")) {
      // Find first allowed route (in priority order)
      if (userHasPermission(profile, "orders")) {
        router.replace("/admin/orders");
      } else if (userHasPermission(profile, "menu")) {
        router.replace("/admin/menu");
      } else if (userHasPermission(profile, "inventory")) {
        router.replace("/admin/inventory");
      } else if (userHasPermission(profile, "pos") || userHasPermission(profile, "kitchen")) {
        router.replace("/pos-kitchen");
      } else if (userHasPermission(profile, "employees")) {
        router.replace("/admin/employees");
      } else if (userHasPermission(profile, "reports")) {
        router.replace("/admin/reports");
      } else if (userHasPermission(profile, "settings")) {
        router.replace("/admin/settings");
      }
      // If no specific permission, they'll see the "Access Restricted" message on dashboard
    }
  }, [profile, pathname, loading, router]);

  // Subscribe to new incoming orders for toast + sound alert
  useEffect(() => {
    if (!profile) return;

    const unsub = subscribeOrders((list) => {
      // Find orders created after the layout or last order alert was recorded
      const newIncoming = list.filter(o => o.createdAt > lastAlertRef.current && o.status === "received");
      if (newIncoming.length > 0) {
        newIncoming.forEach(o => {
          toast.success(`New order received! #${o.dailyOrderNumber ?? o.orderNumber}`, {
            description: `${o.customerName} · ${o.type.replace("_", " ")}`,
            duration: 8000
          });
          playOrderSound();
        });
        const maxTime = newIncoming.reduce((max, o) => o.createdAt > max ? o.createdAt : max, lastAlertRef.current);
        lastAlertRef.current = maxTime;
      }
    });

    return () => unsub();
  }, [profile]);

  if (loading || !checked) {
    return <AdminAuthLoading />;
  }

  if (!firebaseUser) return null;

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
         <h1 className="text-xl font-bold">Profile required</h1>
         <p className="max-w-md text-muted-foreground">
           Signed in as <strong>{firebaseUser.email}</strong>. Create Firestore document{" "}
           <code>users/{firebaseUser.uid}</code> with role <code>admin</code> or{" "}
           <code>super_admin</code>.
         </p>
         <Button onClick={() => refreshProfile()}>Retry</Button>
         <Link href="/login" className="text-sm text-primary hover:underline">
           Back to login
         </Link>
      </div>
    );
  }

  if (profile.role === "employee") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="max-w-md text-muted-foreground">
          Signed in as <strong>{profile.email || firebaseUser.email}</strong> ({profile.displayName}).
          Employees are not authorized to access the admin area. Please use an authorized staff account.
        </p>
        <div className="flex gap-4">
          <Button variant="destructive" onClick={async () => {
            await useAuthStore.getState().logout();
            router.push("/login");
          }}>
            Log Out & Go to Login
          </Button>
          <Link href="/home" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
            Go to Website
          </Link>
        </div>
      </div>
    );
  }

  // Show dashboard content only if user has permission, otherwise show access denied message
  const canAccessDashboard = userHasPermission(profile, "dashboard") || profile.role === "super_admin" || profile.role === "admin";
  const isDashboardRoute = pathname === "/admin";

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <AdminMobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="truncate font-bold text-sm">{profile.displayName ?? "Admin"}</span>
          <Link href="/pos" className="text-xs font-semibold text-primary">
            POS
          </Link>
        </header>
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          {isDashboardRoute && !canAccessDashboard ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
              <h2 className="text-2xl font-bold text-destructive">Dashboard Access Restricted</h2>
              <p className="max-w-md text-muted-foreground">
                You don't have permission to view the dashboard. Please contact your administrator to request access.
              </p>
              <p className="text-sm text-muted-foreground">
                You can access other sections from the sidebar based on your assigned permissions.
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
