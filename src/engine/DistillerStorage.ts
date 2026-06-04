import type { ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import { KeyedSlotStorage } from "./KeyedSlotStorage";
import {
    DISTILLER_FUEL_ITEMS,
    DISTILLER_FUEL_PER_CYCLE,
    DISTILLER_MATERIAL_DEF,
    findAllRecipesForInput,
    isAcceptableInputItem,
    type ProcessingRecipe,
} from "./ProcessingRecipes";
import { setEnabledInVoxel } from "./VoxelDefs";

/**
 * 蒸留器（distiller）のスロット種別（doc/26 §3.5）。
 * - fuel: 燃料（木材）。蒸留を回すために消費（副産物なし）
 * - material: 素材（麦もろみ）
 * - output: 麦焼酎
 */
export type DistillerSlotKind = "fuel" | "material" | "output";

export interface DistillerSlots {
    fuel: ItemStack | null;
    material: ItemStack | null;
    output: ItemStack | null;
    /** material スロットの複数レシピ選択 index（現状1種のみだが将来用・スキーマ共通化用）。 */
    selectedRecipeIndex: number;
}

function canStackInto(slot: ItemStack | null, out: { itemId: string; count: number }): boolean {
    if (slot === null) return true;
    if (slot.itemId !== out.itemId) return false;
    const max = getItemDef(out.itemId)?.maxStack ?? 64;
    return slot.count + out.count <= max;
}

function addToSlot(slot: ItemStack | null, out: { itemId: string; count: number }): ItemStack {
    if (slot === null) return { itemId: out.itemId as ItemStack["itemId"], count: out.count };
    return { itemId: slot.itemId, count: slot.count + out.count };
}

/**
 * 蒸留器のスロット状態を座標ベースで管理するストレージ。
 * day_changed のたびに「燃料＋麦もろみ」が揃っていれば1サイクル蒸留して麦焼酎を産出する。
 * 焚き火（BonfireStorage）と同型だが副産物が無く、燃料は蒸留時のみ消費する。
 */
export class DistillerStorage extends KeyedSlotStorage<DistillerSlots> {
    protected createDefaultSlots(): DistillerSlots {
        return { fuel: null, material: null, output: null, selectedRecipeIndex: 0 };
    }

    protected isSlotsEmpty(slots: DistillerSlots): boolean {
        return slots.fuel === null && slots.material === null && slots.output === null;
    }

    protected cloneSlots(slots: DistillerSlots): DistillerSlots {
        return {
            fuel: slots.fuel ? { ...slots.fuel } : null,
            material: slots.material ? { ...slots.material } : null,
            output: slots.output ? { ...slots.output } : null,
            selectedRecipeIndex: slots.selectedRecipeIndex,
        };
    }

    protected toItemStacks(slots: DistillerSlots): ItemStack[] {
        const result: ItemStack[] = [];
        if (slots.fuel) result.push({ ...slots.fuel });
        if (slots.material) result.push({ ...slots.material });
        if (slots.output) result.push({ ...slots.output });
        return result;
    }

    /** 燃料と素材が両方揃っていれば稼働中（蒸留中）とみなす。 */
    isBurning(pos: Pos2D): boolean {
        const slots = this.getRaw(pos);
        return slots != null && slots.fuel != null && slots.fuel.count >= 1 && slots.material != null && slots.material.count >= 1;
    }

    getSlot(pos: Pos2D, kind: DistillerSlotKind): ItemStack | null {
        const slots = this.getRaw(pos);
        return slots ? (slots[kind] ?? null) : null;
    }

    getSelectedRecipeIndex(pos: Pos2D): number {
        return this.getRaw(pos)?.selectedRecipeIndex ?? 0;
    }

    setSelectedRecipeIndex(pos: Pos2D, index: number): void {
        const slots = this.getRaw(pos);
        if (slots) slots.selectedRecipeIndex = index;
    }

    canAcceptFuel(itemId: string): boolean {
        return DISTILLER_FUEL_ITEMS.includes(itemId as never);
    }

    canAcceptMaterial(itemId: string): boolean {
        return isAcceptableInputItem(DISTILLER_MATERIAL_DEF, itemId as never);
    }

    setSlot(pos: Pos2D, kind: DistillerSlotKind, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;

        if (stack !== null) {
            if (kind === "fuel" && !this.canAcceptFuel(stack.itemId)) return;
            if (kind === "material" && !this.canAcceptMaterial(stack.itemId)) return;
        }

        slots[kind] = stack;
        this.updateVoxelEnabled(pos, voxelMap);
    }

    override onDailyTick(voxelMap: IVoxelWriter): void {
        for (const [key, slots] of this.entries()) {
            const pos = this.posFromKey(key);

            const recipe = slots.material ? this.matchMaterialRecipe(slots.material.itemId, slots.selectedRecipeIndex) : null;
            const hasFuel = slots.fuel != null && slots.fuel.count >= DISTILLER_FUEL_PER_CYCLE;
            const hasMaterial = slots.material != null && recipe != null && slots.material.count >= recipe.inputCountPerCycle;

            if (hasFuel && hasMaterial && recipe != null && canStackInto(slots.output, recipe.outputs[0])) {
                const fuel = slots.fuel as ItemStack;
                const material = slots.material as ItemStack;
                fuel.count -= DISTILLER_FUEL_PER_CYCLE;
                material.count -= recipe.inputCountPerCycle;
                slots.output = addToSlot(slots.output, recipe.outputs[0]);
                if (fuel.count <= 0) slots.fuel = null;
                if (material.count <= 0) slots.material = null;
            }

            this.updateVoxelEnabled(pos, voxelMap);
        }
    }

    private matchMaterialRecipe(itemId: string, selectedIndex: number): ProcessingRecipe | null {
        const matches = findAllRecipesForInput(DISTILLER_MATERIAL_DEF, itemId as never);
        if (matches.length === 0) return null;
        const idx = selectedIndex >= 0 && selectedIndex < matches.length ? selectedIndex : 0;
        return matches[idx];
    }

    /** voxel の enabled ビットに稼働状態を反映する（スプライト切替に使う）。 */
    private updateVoxelEnabled(pos: Pos2D, voxelMap: IVoxelWriter): void {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surface);
        voxelMap.set(setEnabledInVoxel(voxel, this.isBurning(pos)), surface);
    }
}
