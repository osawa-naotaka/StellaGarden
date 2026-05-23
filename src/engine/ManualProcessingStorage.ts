import type { ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import { KeyedSlotStorage } from "./KeyedSlotStorage";
import { findRecipeForInput, getManualProcessingDef, isAcceptableInputItem, type ManualProcessingDef, type ProcessingRecipe } from "./ProcessingRecipes";
import { ENTITY_TYPES, getEntityTypeFromVoxel } from "./VoxelDefs";

/** 1施設のスロット状態。outputs は最大2スロット（不要なスロットは null）。
 *
 * `selectedRecipeIndex` は、同じ入力 itemId に対して複数レシピが登録されている施設（例: 金床）で
 * プレイヤーがどのレシピを選んだかを保持する。マッチするレシピが1件しかない施設では使われない。
 * `findRecipeForInput` 側で範囲外は 0 にクランプされるため、ここでは単純な number として扱う。
 */
export interface ManualProcessingSlots {
    input: ItemStack | null;
    outputs: [ItemStack | null, ItemStack | null];
    selectedRecipeIndex: number;
}

/**
 * カテゴリ2（手動処理）施設のスロットを座標ベースで管理するストレージ。
 * threshing_machine / screw_presses / scutching_board / spinning_wheel / loom / anvil が利用する。
 *
 * `tryProcessOnce(pos, voxelMap)` が UI の「処理」ボタン側から定期的に呼ばれる。
 * 入力スロットの itemId に対応するレシピを引き、入力消費 → 出力加算をアトミックに実行する。
 */
export class ManualProcessingStorage extends KeyedSlotStorage<ManualProcessingSlots> {
    protected createDefaultSlots(): ManualProcessingSlots {
        return { input: null, outputs: [null, null], selectedRecipeIndex: 0 };
    }

    protected isSlotsEmpty(slots: ManualProcessingSlots): boolean {
        // selectedRecipeIndex は施設選択状態（=ユーザー設定）であり、空判定には含めない。
        return slots.input === null && slots.outputs[0] === null && slots.outputs[1] === null;
    }

    protected cloneSlots(slots: ManualProcessingSlots): ManualProcessingSlots {
        return {
            input: slots.input ? { ...slots.input } : null,
            outputs: [slots.outputs[0] ? { ...slots.outputs[0] } : null, slots.outputs[1] ? { ...slots.outputs[1] } : null],
            selectedRecipeIndex: slots.selectedRecipeIndex,
        };
    }

    protected toItemStacks(slots: ManualProcessingSlots): ItemStack[] {
        const result: ItemStack[] = [];
        if (slots.input) result.push({ ...slots.input });
        if (slots.outputs[0]) result.push({ ...slots.outputs[0] });
        if (slots.outputs[1]) result.push({ ...slots.outputs[1] });
        return result;
    }

    /** 指定座標の施設のエンティティタイプを voxelMap から取り出す。アンカー以外を渡された場合は ENTITY_TYPES.none を返す。 */
    private getEntityTypeAt(pos: Pos2D, voxelMap: IVoxelWriter): number {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        return getEntityTypeFromVoxel(voxelMap.get(surface));
    }

    getInput(pos: Pos2D): ItemStack | null {
        return this.getRaw(pos)?.input ?? null;
    }

    getOutput(pos: Pos2D, index: 0 | 1): ItemStack | null {
        return this.getRaw(pos)?.outputs[index] ?? null;
    }

    /**
     * 入力スロットを更新する。voxelMap は処理状態に応じて将来スプライトを変える際に使う（現状は no-op）。
     * 受理可否（itemId）は呼び出し側でチェックすること。
     */
    setInput(pos: Pos2D, stack: ItemStack | null, _voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.input = stack;
    }

    /** 出力スロットを更新する（取り出し用途）。配置は本来禁止だが UI 層で制限する設計。 */
    setOutput(pos: Pos2D, index: 0 | 1, stack: ItemStack | null, _voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.outputs[index] = stack;
    }

    /** 同一入力に対する複数レシピのうち、現在選択されているインデックスを返す。施設が存在しなければ 0。 */
    getSelectedRecipeIndex(pos: Pos2D): number {
        return this.getRaw(pos)?.selectedRecipeIndex ?? 0;
    }

    /** プレイヤーが UI のドロップダウンで選択した recipe index を保存する。 */
    setSelectedRecipeIndex(pos: Pos2D, index: number): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.selectedRecipeIndex = index;
    }

    /** 入力スロットがこの施設で受理可能な itemId かどうか。 */
    canAcceptInput(pos: Pos2D, itemId: string, voxelMap: IVoxelWriter): boolean {
        const entityType = this.getEntityTypeAt(pos, voxelMap);
        const def = getManualProcessingDef(entityType);
        if (!def) return false;
        return isAcceptableInputItem(def, itemId as never);
    }

    /**
     * 副作用なしで「いま処理可能か」を判定する。
     * UI 側で「ボタンを押した瞬間に進捗バーを動かしてよいか」を決めるのに使う。
     */
    canProcess(pos: Pos2D, voxelMap: IVoxelWriter): boolean {
        const slots = this.getRaw(pos);
        if (!slots) return false;
        const entityType = this.getEntityTypeAt(pos, voxelMap);
        if (entityType === ENTITY_TYPES.none) return false;
        const def = getManualProcessingDef(entityType);
        if (!def) return false;
        return this.findApplicableRecipe(slots, def) !== null;
    }

    /**
     * 1サイクル分の処理を試みる。以下を全て満たす場合のみ実行する:
     *  - 入力スロットに対応レシピがある
     *  - 入力数 >= inputCountPerCycle
     *  - 全ての出力スロットに、出力する分の余裕がある（または空）
     *
     * 成功時 true、何もできなかった場合 false。
     */
    tryProcessOnce(pos: Pos2D, voxelMap: IVoxelWriter): boolean {
        const slots = this.getRaw(pos);
        if (!slots) return false;
        const entityType = this.getEntityTypeAt(pos, voxelMap);
        if (entityType === ENTITY_TYPES.none) return false;
        const def = getManualProcessingDef(entityType);
        if (!def) return false;
        const recipe = this.findApplicableRecipe(slots, def);
        if (!recipe || !slots.input) return false;

        // 入力消費
        slots.input.count -= recipe.inputCountPerCycle;
        if (slots.input.count <= 0) slots.input = null;

        // 出力加算
        for (let i = 0; i < recipe.outputs.length; i++) {
            const out = recipe.outputs[i];
            const slot = slots.outputs[i];
            if (slot === null) {
                slots.outputs[i] = { itemId: out.itemId, count: out.count };
            } else {
                slot.count += out.count;
            }
        }

        return true;
    }

    /**
     * 入力スロット・出力スロットの状態に対して、いま適用可能なレシピを返す（副作用なし）。
     * 入力なし／レシピマッチなし／入力数不足／出力満杯のいずれかなら null。
     */
    private findApplicableRecipe(slots: ManualProcessingSlots, def: ManualProcessingDef): ProcessingRecipe | null {
        if (!slots.input) return null;
        const recipe = findRecipeForInput(def, slots.input.itemId, slots.selectedRecipeIndex);
        if (!recipe) return null;
        if (slots.input.count < recipe.inputCountPerCycle) return null;
        for (let i = 0; i < recipe.outputs.length; i++) {
            const out = recipe.outputs[i];
            const slot = slots.outputs[i];
            if (slot === null) continue;
            if (slot.itemId !== out.itemId) return null;
            const max = getItemDef(out.itemId)?.maxStack ?? 64;
            if (slot.count + out.count > max) return null;
        }
        return recipe;
    }
}
