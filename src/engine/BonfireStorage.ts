import type { ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import { KeyedSlotStorage } from "./KeyedSlotStorage";
import {
    BONFIRE_FUEL_DEF,
    BONFIRE_MATERIAL_DEF,
    findAllRecipesForInput,
    isAcceptableInputItem,
    type ProcessingRecipe,
} from "./ProcessingRecipes";
import { setEnabledInVoxel } from "./VoxelDefs";

/**
 * 焚き火（bonfire）のスロット種別（doc/26 §3.2）。
 * - fuel: 燃料（木材・茎）。燃やすと草木灰を生む
 * - material: 素材（大豆・麦）。火で蒸す/炒る
 * - outputAsh: 草木灰（燃料の燃焼副産物）
 * - outputSteamed: 蒸し系（蒸し大豆 / 蒸麦 / 炒り麦）
 */
export type BonfireSlotKind = "fuel" | "material" | "outputAsh" | "outputSteamed";

export interface BonfireSlots {
    fuel: ItemStack | null;
    material: ItemStack | null;
    outputAsh: ItemStack | null;
    outputSteamed: ItemStack | null;
    /** material スロットの複数レシピ（蒸麦 / 炒り麦）の選択 index。 */
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
 * 焚き火のスロット状態を座標ベースで管理するストレージ。
 * 炉（ForgeStorage）と同じく、day_changed のたびに在庫を消費して出力を加算する。
 * 「燃料 → 草木灰」と「素材 → 蒸し系」を1日ごとに同時処理する。
 */
export class BonfireStorage extends KeyedSlotStorage<BonfireSlots> {
    protected createDefaultSlots(): BonfireSlots {
        return { fuel: null, material: null, outputAsh: null, outputSteamed: null, selectedRecipeIndex: 0 };
    }

    protected isSlotsEmpty(slots: BonfireSlots): boolean {
        return slots.fuel === null && slots.material === null && slots.outputAsh === null && slots.outputSteamed === null;
    }

    protected cloneSlots(slots: BonfireSlots): BonfireSlots {
        return {
            fuel: slots.fuel ? { ...slots.fuel } : null,
            material: slots.material ? { ...slots.material } : null,
            outputAsh: slots.outputAsh ? { ...slots.outputAsh } : null,
            outputSteamed: slots.outputSteamed ? { ...slots.outputSteamed } : null,
            selectedRecipeIndex: slots.selectedRecipeIndex,
        };
    }

    protected toItemStacks(slots: BonfireSlots): ItemStack[] {
        const result: ItemStack[] = [];
        if (slots.fuel) result.push({ ...slots.fuel });
        if (slots.material) result.push({ ...slots.material });
        if (slots.outputAsh) result.push({ ...slots.outputAsh });
        if (slots.outputSteamed) result.push({ ...slots.outputSteamed });
        return result;
    }

    /** 燃料があれば燃焼中（点火状態）。 */
    isBurning(pos: Pos2D): boolean {
        const slots = this.getRaw(pos);
        return slots != null && slots.fuel != null && slots.fuel.count >= 1;
    }

    getSlot(pos: Pos2D, kind: BonfireSlotKind): ItemStack | null {
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

    /** fuel スロットがこの itemId を受け入れ可能か（既存と同一 or 燃料レシピに存在）。 */
    canAcceptFuel(itemId: string): boolean {
        return isAcceptableInputItem(BONFIRE_FUEL_DEF, itemId as never);
    }

    /** material スロットがこの itemId を受け入れ可能か。 */
    canAcceptMaterial(itemId: string): boolean {
        return isAcceptableInputItem(BONFIRE_MATERIAL_DEF, itemId as never);
    }

    /**
     * スロットを設定する。fuel / material は受理可能 itemId を検証する。
     * 出力スロットは取り出し（null 設定）・戻し入れ用にそのまま設定する。
     * 設定後、voxel の enabled ビット（点火状態）を更新する。
     */
    setSlot(pos: Pos2D, kind: BonfireSlotKind, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
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
            const lit = slots.fuel != null && slots.fuel.count >= 1;

            if (lit) {
                // 燃料 → 草木灰（燃焼副産物）
                const fuel = slots.fuel as ItemStack;
                const fuelRecipe = this.matchFuelRecipe(fuel.itemId);
                if (fuelRecipe && fuel.count >= fuelRecipe.inputCountPerCycle) {
                    const out = fuelRecipe.outputs[0];
                    if (canStackInto(slots.outputAsh, out)) {
                        fuel.count -= fuelRecipe.inputCountPerCycle;
                        slots.outputAsh = addToSlot(slots.outputAsh, out);
                        if (fuel.count <= 0) slots.fuel = null;
                    }
                }

                // 素材 → 蒸し系（火に掛けて加工）
                if (slots.material != null) {
                    const recipe = this.matchMaterialRecipe(slots.material.itemId, slots.selectedRecipeIndex);
                    if (recipe && slots.material.count >= recipe.inputCountPerCycle) {
                        const out = recipe.outputs[0];
                        if (canStackInto(slots.outputSteamed, out)) {
                            slots.material.count -= recipe.inputCountPerCycle;
                            slots.outputSteamed = addToSlot(slots.outputSteamed, out);
                            if (slots.material.count <= 0) slots.material = null;
                        }
                    }
                }
            }

            this.updateVoxelEnabled(pos, voxelMap);
        }
    }

    private matchFuelRecipe(itemId: string): ProcessingRecipe | null {
        const matches = findAllRecipesForInput(BONFIRE_FUEL_DEF, itemId as never);
        return matches[0] ?? null;
    }

    private matchMaterialRecipe(itemId: string, selectedIndex: number): ProcessingRecipe | null {
        const matches = findAllRecipesForInput(BONFIRE_MATERIAL_DEF, itemId as never);
        if (matches.length === 0) return null;
        const idx = selectedIndex >= 0 && selectedIndex < matches.length ? selectedIndex : 0;
        return matches[idx];
    }

    /** voxel の enabled ビットに点火状態を反映する（スプライト切替に使う）。 */
    private updateVoxelEnabled(pos: Pos2D, voxelMap: IVoxelWriter): void {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surface);
        voxelMap.set(setEnabledInVoxel(voxel, this.isBurning(pos)), surface);
    }
}
