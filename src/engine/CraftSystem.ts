import type { CraftStation, ICraftSystem, IInventoryWriter, ItemStack, RecipeDef } from "../_boundary/interfaces";
import type { UIState } from "../view/UIState";
import { RECIPES } from "./RecipeDefs";
import type { WorkbenchStorage } from "./WorkbenchStorage";

export class CraftSystem implements ICraftSystem {
    private readonly inventory: IInventoryWriter;
    private readonly workbenchStorage: WorkbenchStorage;
    private readonly uiState: UIState;

    constructor(inventory: IInventoryWriter, workbenchStorage: WorkbenchStorage, uiState: UIState) {
        this.inventory = inventory;
        this.workbenchStorage = workbenchStorage;
        this.uiState = uiState;
    }

    getAvailableRecipes(station: CraftStation): readonly RecipeDef[] {
        if (station === "hand") {
            return RECIPES.filter((r) => r.station === "hand");
        }
        // workbench では全レシピ（素手レシピ含む）を返す
        return RECIPES;
    }

    getToolSlot(): ItemStack | null {
        const pos = this.uiState.targetPos;
        if (!pos) return null;
        return this.workbenchStorage.getTool(pos);
    }

    setToolSlot(stack: ItemStack | null): void {
        const pos = this.uiState.targetPos;
        if (!pos) return;
        this.workbenchStorage.setTool(pos, stack);
    }

    canCraft(recipe: RecipeDef): boolean {
        const toolSlot = this.getToolSlot();
        if (recipe.requiredTool && toolSlot?.itemId !== recipe.requiredTool.itemId) {
            return false;
        }

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

        // 成果物が追加可能か先に確認（アトミック: 入らなければ素材も消費しない）
        if (!this.inventory.addItems([{ itemId: recipe.result.itemId, count: recipe.result.count }])) {
            return false;
        }

        // 成果物の追加が成功したので、素材を消費する
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

        return true;
    }
}
