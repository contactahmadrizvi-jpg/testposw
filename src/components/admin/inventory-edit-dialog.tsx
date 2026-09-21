"use client";

import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventoryItem, InventoryUnit } from "@/types";

const UNITS: InventoryUnit[] = ["kg", "gram", "liter", "piece", "slice", "bottle", "pack"];

interface Props {
  item: InventoryItem;
  onSave: (data: Partial<InventoryItem>) => Promise<void>;
}

export function InventoryEditDialog({ item, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    currentStock: String(item.currentStock),
    totalStock: String(item.totalStock ?? item.currentStock),
    minStock: String(item.minStock),
    costPerUnit: String(item.costPerUnit || ""),
    totalPrice: String((Number(item.totalStock ?? item.currentStock) || 0) * (item.costPerUnit || 0) || ""),
    preventSellWhenLow: item.preventSellWhenLow,
  });

  useEffect(() => {
    if (open) {
      const initialTotal = item.totalStock ?? item.currentStock;
      const initialCost = item.costPerUnit || 0;
      const initialTotalVal = initialTotal * initialCost;
      setForm({
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        currentStock: String(item.currentStock),
        totalStock: String(initialTotal),
        minStock: String(item.minStock),
        costPerUnit: String(initialCost || ""),
        totalPrice: initialTotalVal > 0 ? String(initialTotalVal) : "",
        preventSellWhenLow: item.preventSellWhenLow,
      });
    }
  }, [open, item]);

  // When total stock changes, auto-update remaining stock by the difference
  const handleTotalStockChange = (newTotalVal: string) => {
    const prevTotal = Number(item.totalStock ?? item.currentStock) || 0;
    const newTotal = Number(newTotalVal) || 0;
    const diff = newTotal - prevTotal;
    const newRemaining = Math.max(0, item.currentStock + diff);
    
    // Auto-calculate total price if cost per unit is set
    const unitCost = Number(form.costPerUnit) || 0;
    const newTotPrice = unitCost > 0 && newTotal > 0 ? String(parseFloat((newTotal * unitCost).toFixed(2))) : form.totalPrice;

    setForm((prev) => ({
      ...prev,
      totalStock: newTotalVal,
      currentStock: String(newRemaining),
      totalPrice: newTotPrice,
    }));
  };

  const handleCostPerUnitChange = (costVal: string) => {
    const unitCost = Number(costVal) || 0;
    const totalQty = Number(form.totalStock) || 0;
    const newTotPrice = costVal && totalQty > 0 ? String(parseFloat((totalQty * unitCost).toFixed(2))) : "";
    setForm((prev) => ({
      ...prev,
      costPerUnit: costVal,
      totalPrice: newTotPrice,
    }));
  };

  const handleTotalPriceChange = (totPriceVal: string) => {
    const totPrice = Number(totPriceVal) || 0;
    const totalQty = Number(form.totalStock) || 0;
    const unitCost = totPriceVal && totalQty > 0 ? String(parseFloat((totPrice / totalQty).toFixed(2))) : "";
    setForm((prev) => ({
      ...prev,
      totalPrice: totPriceVal,
      costPerUnit: unitCost,
    }));
  };

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        sku: form.sku.trim(),
        unit: form.unit as InventoryUnit,
        currentStock: Number(form.currentStock) || 0,
        totalStock: Number(form.totalStock) || 0,
        minStock: Number(form.minStock) || 0,
        costPerUnit: Number(form.costPerUnit) || 0,
        preventSellWhenLow: form.preventSellWhenLow,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-1 h-3 w-3" /> Edit
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">Edit inventory</h3>
        <p className="text-sm text-muted-foreground">{item.name}</p>
        <div className="mt-4 grid gap-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div>
            <Label>Unit</Label>
            <select
              className="flex h-11 w-full rounded-xl border px-3 py-0 text-sm"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value as InventoryUnit })}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Total Stock</Label>
              <Input
                type="number"
                value={form.totalStock}
                onChange={(e) => handleTotalStockChange(e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground">Auto-adjusts remaining stock</span>
            </div>
            <div>
              <Label>Current (Remaining) Stock</Label>
              <Input
                type="number"
                value={form.currentStock}
                onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
              />
              <span className="text-[10px] text-muted-foreground">Available to consume</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price per Unit (Rs)</Label>
              <Input
                type="number"
                step="any"
                placeholder="Rs / unit"
                value={form.costPerUnit}
                onChange={(e) => handleCostPerUnitChange(e.target.value)}
              />
            </div>
            <div>
              <Label>Total Price (Rs)</Label>
              <Input
                type="number"
                step="any"
                placeholder="Total value"
                value={form.totalPrice}
                onChange={(e) => handleTotalPriceChange(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Min Stock Alert</Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 5"
                value={form.minStock}
                className="w-full"
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm pb-1">
                <input
                  type="checkbox"
                  checked={form.preventSellWhenLow}
                  onChange={(e) => setForm({ ...form, preventSellWhenLow: e.target.checked })}
                />
                Block sales when low
              </label>
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
