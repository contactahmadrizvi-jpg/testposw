"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Star, Truck, ChevronLeft, ChevronRight, Flame, ShoppingCart, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FoodCard } from "@/components/customer/food-card";
import { getActiveCategories, getAvailableMenuItems, getActiveDeals } from "@/services/menu.service";
import { HOME_MENU_SECTION_IDS } from "@/data/default-menu-categories";
import { useCartStore } from "@/stores/cart-store";
import type { MenuCategory, MenuItem, Deal } from "@/types";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { toast } from "sonner";

/* ─────────────────────────────────────────────
   Deal Image Carousel (per-deal)
───────────────────────────────────────────── */
function DealCarousel({ dealItems }: { dealItems: MenuItem[] }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prev = useCallback(() => setIdx((i) => (i === 0 ? dealItems.length - 1 : i - 1)), [dealItems.length]);
  const next = useCallback(() => setIdx((i) => (i === dealItems.length - 1 ? 0 : i + 1)), [dealItems.length]);

  // Auto-advance every 2.5s
  useEffect(() => {
    if (dealItems.length <= 1) return;
    timerRef.current = setInterval(next, 2500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [next, dealItems.length]);

  if (dealItems.length === 0) {
    return (
      <div className="h-52 w-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-5xl rounded-t-3xl">
        🍔
      </div>
    );
  }

  const current = dealItems[idx]!;

  return (
    <div className="relative h-52 w-full overflow-hidden rounded-t-3xl bg-muted">
      {/* Slides */}
      {dealItems.map((item, i) => (
        <div key={item.id}
          className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? "opacity-100 z-10" : "opacity-0 z-0"}`}>
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
            : <div className="h-full w-full bg-gradient-to-br from-primary/10 to-muted flex items-center justify-center text-6xl">🍔</div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        </div>
      ))}

      {/* Item label */}
      <div className="absolute bottom-3 left-4 z-20">
        <p className="text-white font-bold text-sm drop-shadow leading-tight">{current.name}</p>
      </div>

      {/* Arrows */}
      {dealItems.length > 1 && (
        <>
          <button onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition backdrop-blur-sm">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition backdrop-blur-sm">
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {dealItems.length > 1 && (
        <div className="absolute bottom-3 right-3 z-20 flex gap-1">
          {dealItems.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
          ))}
        </div>
      )}

      {/* Thumbnail strip */}
      {dealItems.length > 1 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {dealItems.map((item, i) => (
            <button key={item.id} onClick={() => setIdx(i)}
              className={`h-8 w-8 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? "border-white scale-110 shadow" : "border-white/30 opacity-60 hover:opacity-90"}`}>
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                : <div className="h-full w-full bg-muted flex items-center justify-center text-sm">🍔</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function HomePage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    if (!isFirebaseConfigured()) { setLoading(false); return; }
    Promise.all([getActiveCategories(), getAvailableMenuItems(), getActiveDeals()])
      .then(([c, menuItems, d]) => { setCategories(c); setItems(menuItems); setDeals(d); })
      .finally(() => setLoading(false));
  }, []);

  const homeSections = HOME_MENU_SECTION_IDS.map((id) => {
    const cat = categories.find((c) => c.id === id);
    const catItems = items.filter((i) => i.categoryId === id);
    return cat && catItems.length > 0 ? { cat, items: catItems } : null;
  }).filter(Boolean) as { cat: MenuCategory; items: MenuItem[] }[];

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-background via-primary/5 to-background">
        <motion.div
          animate={{ 
            y: [0, -20, 0], 
            rotate: [0, 5, -5, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-7xl drop-shadow-2xl"
        >
          🍔
        </motion.div>
        <div className="flex flex-col items-center gap-2">
          <p className="animate-pulse text-2xl font-black text-primary">
            Preparing your experience...
          </p>
          <div className="flex gap-1.5">
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} 
              transition={{ duration: 1, repeat: Infinity, delay: 0 }}
              className="h-2 w-2 rounded-full bg-primary"
            />
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} 
              transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              className="h-2 w-2 rounded-full bg-primary"
            />
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} 
              transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              className="h-2 w-2 rounded-full bg-primary"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative min-h-[min(85vh,720px)] overflow-hidden bg-gradient-to-br from-background via-primary/5 to-background">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZjZiNmIiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE0YzMuMzEgMCA2LTIuNjkgNi02cy0yLjY5LTYtNi02LTYgMi42OS02IDYgMi42OSA2IDYgNnptMCA0MGMzLjMxIDAgNi0yLjY5IDYtNnMtMi42OS02LTYtNi02IDIuNjktNiA2IDIuNjkgNiA2IDZ6bS0yMCAwYzMuMzEgMCA2LTIuNjkgNi02cy0yLjY5LTYtNi02LTYgMi42OS02IDYgMi42OSA2IDYgNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>
        <Image
          src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1920&q=85"
          alt="Fresh pizza and burgers"
          fill priority
          className="object-cover opacity-20 mix-blend-lighten"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent" />
        <div className="relative mx-auto flex min-h-[min(85vh,720px)] max-w-7xl items-center px-4 py-16 lg:py-24">
          <motion.div 
            initial={{ opacity: 0, y: 32 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/20 to-accent/20 backdrop-blur-sm px-4 py-2 rounded-full border border-primary/30 shadow-lg mb-5"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Open Now · Fast Delivery Available
              </p>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 text-5xl font-black leading-[1.05] md:text-6xl lg:text-7xl"
            >
              <span className="text-primary drop-shadow-lg">
                Delicious Food,
              </span>
              <br />
              <span className="text-foreground">Delivered Fast.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 max-w-lg text-lg text-muted-foreground leading-relaxed"
            >
              Experience modern dining with premium quality food. Order pizza, burgers, shawarma, and more for delivery or pickup.
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 flex flex-wrap gap-4"
            >
              <Link href="/menu">
                <Button size="lg" className="gap-2 btn-premium text-lg font-bold px-8 py-6 h-auto">
                  Order Now <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/track">
                <Button size="lg" variant="outline"
                  className="border-2 border-primary/40 bg-card/80 backdrop-blur text-lg font-bold text-foreground hover:bg-primary/10 hover:border-primary rounded-xl px-8 py-6 h-auto shadow-lg hover:shadow-xl transition-all">
                  Track Order
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Feature pills ── */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Truck, title: "Fast Delivery", desc: "30-45 min delivery", gradient: "from-blue-500 to-blue-600" },
            { icon: Star, title: "Premium Quality", desc: "Fresh ingredients daily", gradient: "from-amber-500 to-amber-600" },
            { icon: Clock, title: "Open Daily", desc: "1 PM – 10 PM", gradient: "from-green-500 to-green-600" },
          ].map((f, idx) => (
            <motion.div 
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="group relative flex gap-4 rounded-2xl border-2 border-primary/10 bg-white p-6 shadow-md hover:shadow-xl hover:border-primary/30 transition-all duration-300 overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
              <div className={`relative h-14 w-14 rounded-xl bg-gradient-to-br ${f.gradient} p-3 shadow-lg group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                <f.icon className="h-full w-full text-white" />
              </div>
              <div className="relative">
                <h3 className="font-black text-lg text-foreground group-hover:text-primary transition-colors">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Deals Section ── */}
      {deals.length > 0 && (
        <section className="py-20 bg-gradient-to-b from-white via-blue-50/30 to-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMzYjgyZjYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE0YzMuMzEgMCA2LTIuNjkgNi02cy0yLjY5LTYtNi02LTYgMi42OS02IDYgMi42OSA2IDYgNnptMCA0MGMzLjMxIDAgNi0yLjY5IDYtNnMtMi42OS02LTYtNi02IDIuNjktNiA2IDIuNjkgNiA2IDZ6bS0yMCAwYzMuMzEgMCA2LTIuNjkgNi02cy0yLjY5LTYtNi02LTYgMi42OS02IDYgMi42OSA2IDYgNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"></div>
          <div className="mx-auto max-w-7xl px-4 relative">
            {/* Section header */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-end justify-between mb-12"
            >
              <div>
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-4 shadow-lg">
                  <Flame className="h-4 w-4" />
                  Hot Deals
                </div>
                <h2 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Special Combos &amp; Deals
                </h2>
                <p className="text-muted-foreground mt-3 text-base max-w-md">
                  Handpicked combos at unbeatable prices — crafted to satisfy every craving.
                </p>
              </div>
              <Link href="/deals"
                className="hidden sm:flex items-center gap-2 text-sm font-bold text-primary hover:gap-3 transition-all px-4 py-2 rounded-xl hover:bg-primary/5">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            {/* Deal cards grid */}
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {deals.slice(0, 6).map((d, idx) => {
                const dealItems = items.filter((i) => d.menuItemIds?.includes(i.id));

                const lineItems = dealItems.map((item) => {
                  const varId = d.selectedVariants?.[item.id];
                  const varObj = item.variants?.find((v) => v.id === varId);
                  const custom = d.itemPrices?.[item.id];
                  const qty = d.itemQuantities?.[item.id] ?? 1;
                  const unitPrice = custom !== undefined ? custom : item.price + (varObj?.priceModifier ?? 0);
                  return { item, varObj, price: unitPrice * qty, qty };
                });
                const subtotal = lineItems.reduce((s, l) => s + l.price, 0);
                const dealTotal = d.fixedPrice ?? subtotal;

                return (
                  <motion.div
                    key={d.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="group relative rounded-3xl border-2 border-primary/10 bg-white shadow-lg hover:shadow-2xl hover:border-primary/30 transition-all duration-300 flex flex-col overflow-hidden"
                  >
                    {/* Discount badge */}
                    {d.discountPercent && (
                      <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-xl">
                        <Tag className="h-3 w-3" />
                        {d.discountPercent}% OFF
                      </div>
                    )}

                    {/* ── Carousel ── */}
                    <DealCarousel dealItems={dealItems} />

                    {/* ── Card Body ── */}
                    <div className="p-6 flex flex-col flex-1 gap-4">
                      <div className="min-h-[68px] flex flex-col justify-start">
                        <h3 className="text-xl font-black group-hover:text-primary transition-colors leading-tight line-clamp-1">
                          {d.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">{d.description}</p>
                      </div>

                      {/* Per-item breakdown */}
                      {lineItems.length > 0 && (
                        <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border-2 border-dashed border-primary/20 p-4 space-y-2">
                          <p className="text-[10px] uppercase font-bold text-primary tracking-wider">What&apos;s Inside:</p>
                          {lineItems.map(({ item, varObj, price, qty }) => (
                            <div key={item.id} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {item.imageUrl && (
                                  <img src={item.imageUrl} alt={item.name}
                                    className="h-6 w-6 rounded-lg object-cover border-2 border-primary/20 shrink-0" />
                                )}
                                <span className="text-xs font-bold truncate text-foreground">
                                  {qty > 1 && <span className="text-primary font-black mr-1">{qty}x</span>}
                                  {item.name}
                                </span>
                                {varObj && <span className="text-[10px] text-muted-foreground shrink-0">({varObj.name})</span>}
                              </div>
                              <span className="text-xs font-black text-primary shrink-0">Rs {price}</span>
                            </div>
                          ))}
                          <div className="border-t-2 border-dashed border-primary/20 pt-2 mt-2 flex items-center justify-between">
                            <span className="text-xs font-bold text-muted-foreground">Deal Total</span>
                            <div className="flex items-center gap-2">
                              {d.discountPercent && subtotal !== dealTotal && (
                                <span className="text-xs line-through text-muted-foreground/60">Rs {subtotal}</span>
                              )}
                              <span className="text-base font-black text-primary">Rs {dealTotal}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={() => {
                          if (dealItems.length === 0) { toast.error("This deal has no items configured."); return; }
                          dealItems.forEach((item) => {
                            const varId = d.selectedVariants?.[item.id];
                            const qty = d.itemQuantities?.[item.id] ?? 1;
                            addItem(item, qty, varId ? { variantId: varId } : {});
                          });
                          toast.success(`"${d.title}" added to cart!`, { duration: 2000 });
                        }}
                        className="mt-auto w-full font-black gap-2 bg-gradient-to-r from-primary to-blue-600 hover:shadow-lg hover:scale-105 transition-all text-white rounded-xl py-6 h-auto text-base"
                      >
                        <ShoppingCart className="h-5 w-5" />
                        Add to Cart · Rs {dealTotal}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Mobile view all */}
            <div className="mt-10 text-center sm:hidden">
              <Link href="/deals">
                <Button variant="outline" className="gap-2 font-bold rounded-xl border-2 border-primary/30 hover:bg-primary/5">
                  View All Deals <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Categories ── */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-black mb-6">Browse by Category</h2>
            <div className="flex flex-wrap gap-3">
              {categories.map((c, idx) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link 
                    href={`/menu?category=${c.slug}`}
                    className="inline-flex items-center rounded-full border-2 border-primary/20 bg-white px-6 py-3 text-sm font-bold shadow-sm transition-all hover:border-primary hover:shadow-lg hover:scale-105 hover:bg-primary hover:text-white"
                  >
                    {c.name}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ── Menu Sections ── */}
      {homeSections.length === 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-16">
          <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-blue-50/30 p-12 text-center">
            <div className="text-6xl mb-4">🍽️</div>
            <p className="text-muted-foreground text-lg">Our menu is being updated. Check back soon for delicious offerings!</p>
          </div>
        </section>
      ) : (
        homeSections.map(({ cat, items: catItems }, sectionIdx) => (
          <section key={cat.id} className="mx-auto max-w-7xl px-4 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center justify-between gap-4 mb-8"
            >
              <div>
                <h2 className="text-3xl font-black">{cat.name}</h2>
                {cat.description && (
                  <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
                )}
              </div>
              <Link 
                href={`/menu?category=${cat.slug}`}
                className="shrink-0 text-sm font-bold text-primary hover:gap-2 flex items-center gap-1 transition-all px-4 py-2 rounded-xl hover:bg-primary/5"
              >
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {catItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <FoodCard 
                    item={item}
                    onAdd={(variantId) => {
                      const custom: any = {};
                      if (variantId && item.variants) {
                        const v = item.variants.find((x) => x.id === variantId);
                        if (v) { custom.variantId = v.id; custom.variantName = v.name; }
                      }
                      addItem(item, 1, custom);
                      toast.success(`Added ${item.name} to cart`, { duration: 1500 });
                    }}
                  />
                </motion.div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
