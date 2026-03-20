import type { CraftStation, ICraftSystem, IInventoryWriter, RecipeDef } from "../_boundary/interfaces";
import { RECIPES } from "./RecipeDefs";

export class CraftSystem implements ICraftSystem {
    private readonly inventory: IInventoryWriter;

    constructor(inventory: IInventoryWriter) {
        this.inventory = inventory;
    }

    getAvailableRecipes(station: CraftStation): readonly RecipeDef[] {
        if (station === "hand") {
            return RECIPES.filter((r) => r.station === "hand");
        }
        // workbench では全レシピ（素手レシピ含む）を返す
        return RECIPES;
    }

    canCraft(recipe: RecipeDef): boolean {
        for (const ingredient of recipe.ingredients) {
            let total = 0;
            for (let i = 0; i < this.inventory.toolbarSlots.length; i++) {
                const slot = this.inventory.toolbarSlots[i];
                if (slot !== null && slot.itemId === ingredient.itemId) {
                    total += slot.count;
                }
            }
            for (let i = 0; i < this.inventory.inventorySlots.length; i++) {
                const slot = this.inventory.inventorySlots[i];
                if (slot !== null && slot.itemId === ingredient.itemId) {
                    total += slot.count;
                }
            }
            if (total < ingredient.count) {
                return false;
            }
        }
        return true;
    }

    craft(recipe: RecipeDef): boolean {
        if (!this.canCraft(recipe)) {
            return false;
        }

        // 各素材を消費: toolbarSlots → inventorySlots の順に走査
        for (const ingredient of recipe.ingredients) {
            let remaining = ingredient.count;

            // ツールバーから消費
            for (let i = 0; i < this.inventory.toolbarSlots.length && remaining > 0; i++) {
                const ref = { area: "toolbar" as const, index: i };
                const slot = this.inventory.getSlot(ref);
                if (slot === null || slot.itemId !== ingredient.itemId) continue;

                if (slot.count <= remaining) {
                    remaining -= slot.count;
                    this.inventory.setSlot(ref, null);
                } else {
                    this.inventory.setSlot(ref, { itemId: slot.itemId, count: slot.count - remaining });
                    remaining = 0;
                }
            }

            // インベントリから消費
            for (let i = 0; i < this.inventory.inventorySlots.length && remaining > 0; i++) {
                const ref = { area: "inventory" as const, index: i };
                const slot = this.inventory.getSlot(ref);
                if (slot === null || slot.itemId !== ingredient.itemId) continue;

                if (slot.count <= remaining) {
                    remaining -= slot.count;
                    this.inventory.setSlot(ref, null);
                } else {
                    this.inventory.setSlot(ref, { itemId: slot.itemId, count: slot.count - remaining });
                    remaining = 0;
                }
            }
        }

        this.inventory.addItem(recipe.result.itemId, recipe.result.count);
        return true;
    }
}
