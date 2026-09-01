"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, User, Menu as MenuIcon, Moon, Sun, X, Package } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import { useAuthStore } from "@/stores/auth-store";
import { getActiveTrackedOrders } from "@/lib/order-tracking";
import { cn } from "@/lib/utils";
import { RESTAURANT } from "@/constants";
import { SomoLogo } from "@/components/somo-logo";

const links = [
  { href: "/home", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/deals", label: "Deals" },
];

export function CustomerHeader() {
  const pathname = usePathname();
  const count = useCartStore((s) => s.getItemCount());
  const profile = useAuthStore((s) => s.profile);
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [trackedCount, setTrackedCount] = useState(0);
  const [callModalOpen, setCallModalOpen] = useState(false);

  useEffect(() => {
    const update = () => setTrackedCount(getActiveTrackedOrders().length);
    update();
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl shadow-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/home" className="flex items-center gap-3 group">
            <SomoLogo size="md" showText={true} />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition-all hover:bg-primary/20 hover:text-primary",
                  pathname === l.href && "bg-primary text-white hover:bg-primary hover:text-white shadow-lg"
                )}
              >
                {l.label}
              </Link>
            ))}
            {trackedCount > 0 && (
              <Link
                href="/track"
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-primary hover:bg-primary/20 transition-all"
              >
                <Package className="h-4 w-4" />
                Track ({trackedCount})
              </Link>
            )}
            <button 
              onClick={() => setCallModalOpen(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold bg-gradient-to-r from-primary to-accent text-white hover:shadow-xl hover:scale-105 transition-all ml-2 shrink-0"
            >
              📞 Call Us
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <Link href={profile ? "/profile" : "/login"}>
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/20 text-foreground">
                <User className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/cart" className="relative">
              <Button size="icon" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:shadow-xl hover:scale-105 transition-all">
                <ShoppingBag className="h-5 w-5" />
              </Button>
              {count > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px] bg-red-500 border-2 border-card">
                  {count}
                </Badge>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden rounded-xl hover:bg-primary/20 text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(85vw,320px)] flex-col bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary to-accent text-white p-4">
              <span className="font-bold text-lg">Menu</span>
              <button type="button" onClick={() => setMobileOpen(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-2 p-4">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-xl px-4 py-3 font-semibold transition-all",
                    pathname === l.href 
                      ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg" 
                      : "hover:bg-primary/20 hover:text-primary text-foreground"
                  )}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/track"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-xl px-4 py-3 font-semibold text-primary hover:bg-primary/20 transition-all"
              >
                <Package className="h-4 w-4" />
                Track order{trackedCount > 0 ? ` (${trackedCount})` : ""}
              </Link>
              <div className="mt-4">
                <button 
                  onClick={() => { setMobileOpen(false); setCallModalOpen(true); }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 font-bold text-white shadow-lg hover:shadow-xl transition-all text-center w-full text-sm"
                >
                  📞 Call Us Now
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      {callModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setCallModalOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl border-2 border-primary/30 text-center animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent text-white text-2xl shadow-lg">
              📞
            </div>
            <h3 className="text-xl font-black text-foreground">Contact Us</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Call us on any of the numbers below to place your order or make inquiries.
            </p>
            <div className="mt-6 space-y-3">
              <a
                href={`tel:${RESTAURANT.phone}`}
                className="flex items-center justify-between rounded-xl border-2 border-primary/30 bg-primary/10 px-4 py-3.5 text-sm font-bold text-primary hover:bg-primary/20 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
              >
                <span>Primary Line</span>
                <span className="font-mono text-xs">{RESTAURANT.phone}</span>
              </a>
              <a
                href={`tel:${RESTAURANT.phone2}`}
                className="flex items-center justify-between rounded-xl border-2 border-primary/30 bg-primary/10 px-4 py-3.5 text-sm font-bold text-primary hover:bg-primary/20 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
              >
                <span>Secondary Line</span>
                <span className="font-mono text-xs">{RESTAURANT.phone2}</span>
              </a>
            </div>
            <Button variant="ghost" className="mt-6 w-full rounded-xl hover:bg-secondary text-foreground" onClick={() => setCallModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
