import type { ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import { KeyedSlotStorage } from "./KeyedSlotStorage";
import { findRecipeForInput, getDailyProcessingDef, hasEnoughInput, isAcceptableInputItem } from "./ProcessingRecipes";
import { ENTITY_TYPES, getDaysElapsedFromVoxel, getEntityTypeFromVoxel, setDaysElapsedInVoxel, setVariantInVoxel, VOXEL_VARIANT } from "./VoxelDefs";

/** カテゴリ3（日次処理）の状態。 */
export type DailyProcessingState = "empty" | "loading" | "progressing" | "done";

/** 1施設のスロット状態。outputs は最大2スロット（不要なスロットは null）。
 *
 * `selectedRecipeIndex` は ManualProcessingSlots と共有スキーマのため形式上保持するが、
 * 現状の日次処理施設には同一入力で複数レシピの分岐がないため未使用。常に 0。
 */
export interface DailyProcessingSlots {
    input: ItemStack | null;
    outputs: [ItemStack | null, ItemStack | null];
    selectedRecipeIndex: number;
}

/**
 * カテゴリ3（日次処理）施設のスロットを座標ベースで管理するストレージ。
 * compost_bin / soaking_basket / bonfire / kiln が利用する。
 *
 * 進行日数（daysElapsed）は voxel の `growthStage` ビットフィールドに格納する（4bit, 0-15）。
 * 状態（empty / loading / progressing / done）は voxel の `entityType` で表現し、
 * setInput/setOutput/onDailyTick の各タイミングで適切な entityType に書き戻す。
 */
export class DailyProcessingStorage extends KeyedSlotStorage<DailyProcessingSlots> {
    protected createDefaultSlots(): DailyProcessingSlots {
        return { input: null, outputs: [null, null], selectedRecipeIndex: 0 };
    }

    protected isSlotsEmpty(slots: DailyProcessingSlots): boolean {
        return slots.input === null && slots.outputs[0] === null && slots.outputs[1] === null;
    }

    protected cloneSlots(slots: DailyProcessingSlots): DailyProcessingSlots {
        return {
            input: slots.input ? { ...slots.input } : null,
            outputs: [slots.outputs[0] ? { ...slots.outputs[0] } : null, slots.outputs[1] ? { ...slots.outputs[1] } : null],
            selectedRecipeIndex: slots.selectedRecipeIndex,
        };
    }

    getInput(pos: Pos2D): ItemStack | null {
        return this.getRaw(pos)?.input ?? null;
    }

    getOutput(pos: Pos2D, index: 0 | 1): ItemStack | null {
        return this.getRaw(pos)?.outputs[index] ?? null;
    }

    /** 進行日数を返す（voxel の growthStage を読む）。 */
    getDaysElapsed(pos: Pos2D, voxelMap: IVoxelWriter): number {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        return getDaysElapsedFromVoxel(voxelMap.get(surface));
    }

    /** 入力スロットを更新する。itemId が変わる場合は進行日数（growthStage）を 0 にリセットする。 */
    setInput(pos: Pos2D, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) throw new Error("cannot found slots.");
        const oldItemId = slots.input?.itemId ?? null;
        const newItemId = stack?.itemId ?? null;
        slots.input = stack;

        if (newItemId === null) {
            this.resetDaysElapsed(pos, voxelMap, 0);
            return;
        }

        const baseEntityType = this.getBaseEntityTypeAt(pos, voxelMap);
        if (baseEntityType === ENTITY_TYPES.none) throw new Error("cannot found entity.");
        const def = getDailyProcessingDef(baseEntityType);
        if (!def) throw new Error("cannot found daily processing def.");

        const hasEnough = hasEnoughInput(def, newItemId, slots.input?.count ?? 0);

        if (oldItemId !== newItemId) {
            if (hasEnough) {
                this.resetDaysElapsed(pos, voxelMap, 1);
            } else {
                this.resetDaysElapsed(pos, voxelMap, 0);
            }
        } else {
            const currentDaysElapsed = this.getDaysElapsed(pos, voxelMap);
            if (currentDaysElapsed > 0) {
                if (!hasEnough) {
                    this.resetDaysElapsed(pos, voxelMap, 0);
                }
            } else {
                if (hasEnough) {
                    this.resetDaysElapsed(pos, voxelMap, 1);
                }
            }
        }
    }

    /** 出力スロットを更新する（取り出し用途）。 */
    setOutput(pos: Pos2D, index: 0 | 1, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.outputs[index] = stack;
        if (index === 0) {
            const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surface);
            if (stack === null) {
                voxelMap.set(setVariantInVoxel(voxel, VOXEL_VARIANT.base), surface);
            } else {
                voxelMap.set(setVariantInVoxel(voxel, VOXEL_VARIANT.done), surface);
            }
        }
    }

    /** 入力スロットがこの施設で受理可能な itemId かどうか（既存スタックと itemId が一致 or 空かつレシピ対応）。 */
    canAcceptInput(pos: Pos2D, itemId: string, voxelMap: IVoxelWriter): boolean {
        const baseEntityType = this.getBaseEntityTypeAt(pos, voxelMap);
        if (baseEntityType === ENTITY_TYPES.none) return false;
        const def = getDailyProcessingDef(baseEntityType);
        if (!def) return false;
        return isAcceptableInputItem(def, itemId as never);
    }

    /**
     * day_changed 時に全施設を走査し、入力が必要数に達している施設の進行日数を 1 進める。
     * daysRequired に到達した施設は出力スロットに加算する（出力満杯なら保留）。
     */
    override onDailyTick(voxelMap: IVoxelWriter): void {
        for (const [key, slots] of this.entries()) {
            const pos = this.posFromKey(key);
            const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surface);
            const entityType = getEntityTypeFromVoxel(voxel);
            const def = getDailyProcessingDef(entityType);
            if (!slots.input) continue;

            const recipe = findRecipeForInput(def, slots.input.itemId);
            if (slots.input.count < recipe.inputCountPerCycle) continue;

            const daysElapsed = getDaysElapsedFromVoxel(voxel);
            const nextDays = daysElapsed + 1;

            if (nextDays < def.daysRequired + 1) {
                // 進行中（loading → progressing への状態遷移は updateVoxelEntityType で）
                voxelMap.set(setDaysElapsedInVoxel(voxel, nextDays), surface);
                continue;
            }

            // 完了タイミング: 出力スロットの収まり判定（アトミック）
            let canApply = true;
            for (let i = 0; i < recipe.outputs.length; i++) {
                const out = recipe.outputs[i];
                const slot = slots.outputs[i];
                if (slot === null) continue;
                if (slot.itemId !== out.itemId) {
                    canApply = false;
                    break;
                }
                const max = getItemDef(out.itemId)?.maxStack ?? 64;
                if (slot.count + out.count > max) {
                    canApply = false;
                    break;
                }
            }
            if (!canApply) {
                // 出力満杯 → 進行を保留（daysElapsed を上限のまま据え置く）
                voxelMap.set(setDaysElapsedInVoxel(voxel, def.daysRequired - 1), surface);
                continue;
            }

            // 入力消費 + 出力加算
            slots.input.count -= recipe.inputCountPerCycle;
            const newVariantVoxel = setVariantInVoxel(voxel, VOXEL_VARIANT.done);
            if (slots.input.count < recipe.inputCountPerCycle) {
                voxelMap.set(setDaysElapsedInVoxel(newVariantVoxel, 0), surface);
            } else {
                voxelMap.set(setDaysElapsedInVoxel(newVariantVoxel, 1), surface);
            }
            if (slots.input.count <= 0) slots.input = null;
            for (let i = 0; i < recipe.outputs.length; i++) {
                const out = recipe.outputs[i];
                const slot = slots.outputs[i];
                if (slot === null) {
                    slots.outputs[i] = { itemId: out.itemId, count: out.count };
                } else {
                    slot.count += out.count;
                }
            }
        }
    }

    /** 指定座標の施設の「ベース entityType（== empty 状態の entityType）」を返す。施設外なら ENTITY_TYPES.none。 */
    private getBaseEntityTypeAt(pos: Pos2D, voxelMap: IVoxelWriter): number {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        return getEntityTypeFromVoxel(voxelMap.get(surface));
    }

    /** 進行日数（voxel の growthStage）を 0/1 にリセットする。 */
    private resetDaysElapsed(pos: Pos2D, voxelMap: IVoxelWriter, resetTo: number): void {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surface);
        voxelMap.set(setDaysElapsedInVoxel(voxel, resetTo), surface);
    }
}
