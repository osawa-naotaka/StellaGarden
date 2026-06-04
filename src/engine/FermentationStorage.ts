import type { ItemId, ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import { KeyedSlotStorage } from "./KeyedSlotStorage";
import { FERMENTATION_MAX_INGREDIENTS, FERMENTATION_RECIPES, type FermentationRecipe } from "./ProcessingRecipes";
import { getDaysElapsedFromVoxel, setDaysElapsedInVoxel, setEnabledInVoxel } from "./VoxelDefs";

/**
 * 発酵桶（fermentation_vat）のスロット状態（doc/26 §3.4 / §4.1）。
 *
 * 多入力の長期熟成設備。selectedRecipeIndex で品目（味噌 / 醤油もろみ / 麦もろみ / 酢 / 熟成麦焼酎）を選び、
 * そのレシピが必要とする素材を inputs に投入する。全素材が揃うと daysRequired 日かけて熟成し、
 * 完成すると素材セットを消費して output を産出する。経過日数は voxel の growthStage に保持する。
 *
 * inputs は itemId ごとに 1 スロット（固定長 FERMENTATION_MAX_INGREDIENTS、位置は任意）。
 * レシピを切り替えても itemId 単位で素材が紐づくため取りこぼさない。
 */
export interface FermentationSlots {
    inputs: (ItemStack | null)[];
    output: ItemStack | null;
    selectedRecipeIndex: number;
}

function canStackInto(slot: ItemStack | null, out: { itemId: string; count: number }): boolean {
    if (slot === null) return true;
    if (slot.itemId !== out.itemId) return false;
    const max = getItemDef(out.itemId)?.maxStack ?? 64;
    return slot.count + out.count <= max;
}

export class FermentationStorage extends KeyedSlotStorage<FermentationSlots> {
    protected createDefaultSlots(): FermentationSlots {
        return { inputs: new Array(FERMENTATION_MAX_INGREDIENTS).fill(null), output: null, selectedRecipeIndex: 0 };
    }

    protected isSlotsEmpty(slots: FermentationSlots): boolean {
        return slots.output === null && slots.inputs.every((s) => s === null);
    }

    protected cloneSlots(slots: FermentationSlots): FermentationSlots {
        return {
            inputs: slots.inputs.map((s) => (s ? { ...s } : null)),
            output: slots.output ? { ...slots.output } : null,
            selectedRecipeIndex: slots.selectedRecipeIndex,
        };
    }

    protected toItemStacks(slots: FermentationSlots): ItemStack[] {
        const result: ItemStack[] = [];
        for (const s of slots.inputs) if (s) result.push({ ...s });
        if (slots.output) result.push({ ...slots.output });
        return result;
    }

    getSelectedRecipeIndex(pos: Pos2D): number {
        return this.getRaw(pos)?.selectedRecipeIndex ?? 0;
    }

    getRecipe(pos: Pos2D): FermentationRecipe | null {
        return FERMENTATION_RECIPES[this.getSelectedRecipeIndex(pos)] ?? null;
    }

    setSelectedRecipeIndex(pos: Pos2D, index: number, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        if (index < 0 || index >= FERMENTATION_RECIPES.length) return;
        slots.selectedRecipeIndex = index;
        // 品目を変えると必要素材が変わるため進行を仕切り直す。
        this.recompute(pos, voxelMap, true);
    }

    getOutput(pos: Pos2D): ItemStack | null {
        return this.getRaw(pos)?.output ?? null;
    }

    /** 指定 itemId の投入スロットを返す。 */
    getInput(pos: Pos2D, itemId: ItemId): ItemStack | null {
        const slots = this.getRaw(pos);
        if (!slots) return null;
        return slots.inputs.find((s) => s?.itemId === itemId) ?? null;
    }

    setOutput(pos: Pos2D, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.output = stack;
        this.updateVoxelEnabled(pos, voxelMap);
    }

    /** 指定 itemId の投入スロットを設定する（取り出し時は stack=null）。 */
    setInput(pos: Pos2D, itemId: ItemId, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        const idx = slots.inputs.findIndex((s) => s?.itemId === itemId);
        if (stack === null) {
            if (idx >= 0) slots.inputs[idx] = null;
        } else {
            if (stack.itemId !== itemId) return;
            if (idx >= 0) {
                slots.inputs[idx] = stack;
            } else {
                const free = slots.inputs.findIndex((s) => s === null);
                if (free < 0) return;
                slots.inputs[free] = stack;
            }
        }
        this.recompute(pos, voxelMap, false);
    }

    /** itemId が選択中レシピの素材として受理可能か。 */
    canAcceptInput(pos: Pos2D, itemId: string): boolean {
        const recipe = this.getRecipe(pos);
        if (!recipe) return false;
        return recipe.inputs.some((g) => g.itemId === itemId);
    }

    /** 選択中レシピの素材が全て必要数そろっているか。 */
    isReady(pos: Pos2D): boolean {
        const recipe = this.getRecipe(pos);
        if (!recipe) return false;
        return recipe.inputs.every((g) => (this.getInput(pos, g.itemId)?.count ?? 0) >= g.count);
    }

    getDaysElapsed(pos: Pos2D, voxelMap: IVoxelWriter): number {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        return getDaysElapsedFromVoxel(voxelMap.get(surface));
    }

    override onDailyTick(voxelMap: IVoxelWriter): void {
        for (const [key, slots] of this.entries()) {
            const pos = this.posFromKey(key);
            const recipe = FERMENTATION_RECIPES[slots.selectedRecipeIndex];
            if (!recipe) continue;
            if (!this.isReady(pos)) continue;

            const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surface);
            const days = getDaysElapsedFromVoxel(voxel);
            const nextDays = days + 1;

            if (nextDays < recipe.daysRequired + 1) {
                voxelMap.set(setDaysElapsedInVoxel(voxel, nextDays), surface);
                continue;
            }

            // 完成タイミング: 出力スロットに収まらなければ進行を保留して翌日再判定。
            if (!canStackInto(slots.output, recipe.output)) {
                voxelMap.set(setDaysElapsedInVoxel(voxel, recipe.daysRequired), surface);
                continue;
            }

            // 素材セットを消費
            for (const g of recipe.inputs) {
                const idx = slots.inputs.findIndex((s) => s?.itemId === g.itemId);
                if (idx < 0) continue;
                const slot = slots.inputs[idx] as ItemStack;
                slot.count -= g.count;
                if (slot.count <= 0) slots.inputs[idx] = null;
            }
            // 出力を加算
            slots.output =
                slots.output === null ? { itemId: recipe.output.itemId, count: recipe.output.count } : { ...slots.output, count: slots.output.count + recipe.output.count };

            // 次バッチが組めるなら 1、組めないなら 0 にリセット
            voxelMap.set(setDaysElapsedInVoxel(voxel, this.isReady(pos) ? 1 : 0), surface);
            this.updateVoxelEnabled(pos, voxelMap);
        }
    }

    /**
     * 投入状態から進行日数を導出して書き戻す。
     * hardReset 時は 0 に戻してから判定する（レシピ変更時）。
     */
    private recompute(pos: Pos2D, voxelMap: IVoxelWriter, hardReset: boolean): void {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surface);
        const days = hardReset ? 0 : getDaysElapsedFromVoxel(voxel);
        const ready = this.isReady(pos);
        let newDays: number;
        if (!ready) newDays = 0;
        else if (days === 0) newDays = 1;
        else newDays = days;
        voxelMap.set(setDaysElapsedInVoxel(voxel, newDays), surface);
    }

    /** output の有無を voxel の enabled ビットに反映する（スプライト切替に使う）。 */
    private updateVoxelEnabled(pos: Pos2D, voxelMap: IVoxelWriter): void {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surface);
        voxelMap.set(setEnabledInVoxel(voxel, this.getOutput(pos) !== null), surface);
    }
}
