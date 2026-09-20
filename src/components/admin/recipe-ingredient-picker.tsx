"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
              <select
                className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 py-0 text-sm text-foreground"
                value={row.inventoryItemId}
                onChange={(e) => selectInventory(index, e.target.value)}
              >
                {inventory.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.name} — stock: {inv.currentStock} {inv.unit} — Rs {inv.costPerUnit}/{inv.unit}
                  </option>
                ))}
              </select>
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
