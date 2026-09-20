"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MenuItemImage } from "@/components/menu-item-image";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { getItemIngredients } from "@/services/inventory.service";
import type { MenuItem, Recipe } from "@/types";

interface FoodCardProps {
  item: MenuItem;
  onAdd: (variantId?: string) => void;
  /** Recipes (with ingredients) — shown to the customer */
  recipes?: Recipe[];
}

export function FoodCard({ item, onAdd, recipes }: FoodCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<string | undefined>(
    item.variants && item.variants.length > 0 ? item.variants[0].id : undefined
  );

  const price = selectedVariant
    ? item.price + (item.variants?.find((v) => v.id === selectedVariant)?.priceModifier || 0)
    : item.price;

  // Ingredients for the currently selected variant (size recipes first)
  const ingredients = useMemo(
    () => getItemIngredients(recipes ?? [], item.id, selectedVariant),
    [recipes, item.id, selectedVariant]
  );

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] bg-muted shrink-0">
        <MenuItemImage src={item.imageUrl} alt={item.name} fill />
        {item.isPopular && (
          <Badge className="absolute left-3 top-3" variant="warning">Popular</Badge>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-bold">{item.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>

        {ingredients.length > 0 && (
          <div className="mt-2 rounded-lg bg-muted/50 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ingredients</p>
            <p className="mt-0.5 text-xs leading-snug text-foreground/80">
              {ingredients
                .map((ing) => `${ing.inventoryItemName} ${ing.quantity} ${ing.unit}`)
                .join(" · ")}
            </p>
          </div>
        )}

        <div className="flex-1" />

        {item.variants && item.variants.length > 0 && (
          <div className="mt-4 flex gap-2">
            {item.variants.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v.id)}
                className={cn(
                  "flex-1 rounded-lg border py-1.5 text-xs font-bold transition-colors",
                  selectedVariant === v.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-primary/50"
                )}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-lg font-black text-primary">{formatCurrency(price)}</span>
          <Button size="sm" onClick={() => onAdd(selectedVariant)} disabled={!item.isAvailable}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
