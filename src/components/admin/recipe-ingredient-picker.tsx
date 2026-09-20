"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { InventoryItem, RecipeIngredient } from "@/types";

export interface DraftIngredient {
  inventoryItemId: string;
  inventoryItemName: string;
  quantity: number;
  unit: RecipeIngredient["unit"];
}

interface Props {
  inventory: InventoryItem[];
  value: DraftIngredient[];
  onChange: (items: DraftIngredient[]) => void;
}

/**
 * Custom dropdown instead of a native <select>:
 * - native selects render the selected text with OS-level quirks (sliced/clipped
 *   glyphs inside fixed-height boxes) — a plain button renders it perfectly
 * - the options panel is a real element with z-[80], so it always sits above
 *   the z-50 dialog instead of disappearing behind/under native UI
 */
function InventorySelect({
  inventory,
  selectedId,
  onSelect,
}: {
  inventory: InventoryItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = inventory.find((x) => x.id === selectedId);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-foreground",
          open && "border-primary ring-2 ring-primary/30"
        )}
      >
        <span className="min-w-0 break-words leading-snug">
          {selected ? selected.name : "Select inventory item"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="absolute top-full right-0 left-0 z-[80] mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-2xl">
          {inventory.map((inv) => (
            <button
              key={inv.id}
              type="button"
              onClick={() => {
                onSelect(inv.id);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted",
                inv.id === selectedId && "bg-muted/60"
              )}
            >
              <span className="block break-words leading-snug font-medium text-foreground">{inv.name}</span>
              <span className="block text-xs text-muted-foreground">
                stock: {inv.currentStock} {inv.unit} · Rs {inv.costPerUnit}/{inv.unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecipeIngredientPicker({ inventory, value, onChange }: Props) {
  function addRow() {
    const first = inventory[0];
    if (!first) return;
    onChange([
      ...value,
      {
        inventoryItemId: first.id,
        inventoryItemName: first.name,
        quantity: 1,
        unit: first.unit,
      },
    ]);
  }

  function updateRow(index: number, patch: Partial<DraftIngredient>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function selectInventory(index: number, id: string) {
    const item = inventory.find((x) => x.id === id);
    if (!item) return;
    updateRow(index, {
      inventoryItemId: id,
      inventoryItemName: item.name,
      unit: item.unit,
    });
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Recipe ingredients (inventory)</Label>
        <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={!inventory.length}>
          <Plus className="mr-1 h-4 w-4" /> Add ingredient
        </Button>
      </div>
      {!inventory.length && (
        <p className="text-sm text-muted-foreground">Add inventory items first in Inventory page.</p>
      )}
      {value.map((row, index) => {
        const invItem = inventory.find((x) => x.id === row.inventoryItemId);
        const lineCost = invItem ? Math.round(row.quantity * invItem.costPerUnit) : 0;
        return (
          <div key={index} className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              <InventorySelect
                inventory={inventory}
                selectedId={row.inventoryItemId}
                onSelect={(id) => selectInventory(index, id)}
              />
              <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => onChange(value.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Qty"
                  className="h-9 w-24"
                  value={row.quantity}
                  onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })}
                />
                <span className="text-sm text-muted-foreground">{row.unit}</span>
              </div>
              {invItem && (
                <p className="text-xs text-muted-foreground">
                  Price: <span className="font-semibold text-foreground">Rs {invItem.costPerUnit}/{invItem.unit}</span>
                  {row.quantity > 0 && (
                    <span> · Recipe cost: <span className="font-semibold text-foreground">Rs {lineCost.toLocaleString()}</span></span>
                  )}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
