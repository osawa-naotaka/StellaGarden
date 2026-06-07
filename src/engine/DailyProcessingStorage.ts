import type { ItemId, ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { getItemDef } from "../_registry/ItemRegistry";
import { KeyedSlotStorage } from "./KeyedSlotStorage";
import { DAILY_PROCESSING_DEFS, findRecipeForInput, getDailyProcessingDef, hasEnoughInput, isAcceptableInputItem } from "../_registry/ProcessingRecipes";
import { ENTITY_TYPES, getDaysElapsedFromVoxel, getEntityTypeFromVoxel, setDaysElapsedInVoxel, setEnabledInVoxel } from "./VoxelDefs";

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

    protected toItemStacks(slots: DailyProcessingSlots): ItemStack[] {
        const result: ItemStack[] = [];
        if (slots.input) result.push({ ...slots.input });
        if (slots.outputs[0]) result.push({ ...slots.outputs[0] });
        if (slots.outputs[1]) result.push({ ...slots.outputs[1] });
        return result;
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

    /**
     * 入力スロットをまるごと置き換える（主に UI からの直接設定用）。
     * itemId が変わる場合は進行日数をリセットする。
     *
     * プログラム的に「アイテムを追加」したい場合は置換ではなく `addInput` を使うこと
     * （置換セマンティクスは呼び出し側にマージ責務を負わせ、取りこぼしを招きやすいため）。
     */
    setInput(pos: Pos2D, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) throw new Error("cannot found slots.");
        const oldItemId = slots.input?.itemId ?? null;
        const newItemId = stack?.itemId ?? null;
        slots.input = stack;
        this.recomputeInputProgress(pos, voxelMap, oldItemId !== newItemId);
    }

    /**
     * 入力スロットに itemId を count 個まで「加算」する。実際に追加できた個数を返す。
     * 容量・単一 itemId 制約・進行日数の再計算を内部で完結させるため、呼び出し側はマージ計算不要。
     *
     * 0 を返すケース: ストレージ未生成（アンカーずれ等）／count<=0／レシピ非受理／
     * 既存入力と itemId 不一致（単一スロットのため混在不可）／入力が満杯。
     */
    addInput(pos: Pos2D, itemId: ItemId, count: number, voxelMap: IVoxelWriter): number {
        const slots = this.getRaw(pos);
        if (!slots) return 0; // アンカーずれ等で未生成でも tick を巻き込まず素通り
        if (count <= 0) return 0;
        if (!this.canAcceptInput(pos, itemId, voxelMap)) return 0;

        const existing = slots.input;
        if (existing !== null && existing.itemId !== itemId) return 0;

        const maxStack = getItemDef(itemId)?.maxStack ?? 64;
        const existingCount = existing?.itemId === itemId ? existing.count : 0;
        const space = maxStack - existingCount;
        if (space <= 0) return 0;

        const moved = Math.min(space, count);
        const wasEmpty = existing === null;
        slots.input = { itemId, count: existingCount + moved };
        // 空スロットへの新規投入は「itemId 変化」扱いにして進行を仕切り直す（同 itemId の追い投入は進行を保持）。
        this.recomputeInputProgress(pos, voxelMap, wasEmpty);
        return moved;
    }

    /**
     * 現在の入力スロット状態から進行日数（voxel の growthStage）を導出して書き戻す。
     * 旧→新の遷移差分ではなく「いま入力に何個あるか」から決めるため冪等。
     * `itemIdChanged` が true の場合のみ進行をリセットして仕切り直す。
     */
    private recomputeInputProgress(pos: Pos2D, voxelMap: IVoxelWriter, itemIdChanged: boolean): void {
        const slots = this.getRaw(pos);
        if (!slots) return;

        if (slots.input === null) {
            this.resetDaysElapsed(pos, voxelMap, 0);
            return;
        }

        const baseEntityType = this.getBaseEntityTypeAt(pos, voxelMap);
        if (baseEntityType === ENTITY_TYPES.none) throw new Error("cannot found entity.");
        const def = getDailyProcessingDef(baseEntityType);
        const hasEnough = hasEnoughInput(def, slots.input.itemId, slots.input.count);

        if (itemIdChanged) {
            this.resetDaysElapsed(pos, voxelMap, hasEnough ? 1 : 0);
            return;
        }

        const currentDaysElapsed = this.getDaysElapsed(pos, voxelMap);
        if (currentDaysElapsed > 0) {
            if (!hasEnough) this.resetDaysElapsed(pos, voxelMap, 0);
        } else {
            if (hasEnough) this.resetDaysElapsed(pos, voxelMap, 1);
        }
    }

    /** 出力スロットを更新する（取り出し用途）。 */
    setOutput(pos: Pos2D, index: 0 | 1, stack: ItemStack | null, voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.outputs[index] = stack;
        if (index === 0) {
            // output[0] の有無を voxel の enabled bit に反映する（sprites が完了状態を判定するために使う）。
            // variant ビットは向き（縦/横）専用としているため使わない。
            const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
            const voxel = voxelMap.get(surface);
            voxelMap.set(setEnabledInVoxel(voxel, stack !== null), surface);
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
            // 日次処理対象外の entityType（旧セーブに残った焚き火など）は安全にスキップする。
            const def = DAILY_PROCESSING_DEFS[entityType];
            if (!def) continue;
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
            // 完了フラグは enabled ビットに記録する（variant ビットは向き専用に解放）。
            const newEnabledVoxel = setEnabledInVoxel(voxel, true);
            if (slots.input.count < recipe.inputCountPerCycle) {
                voxelMap.set(setDaysElapsedInVoxel(newEnabledVoxel, 0), surface);
            } else {
                voxelMap.set(setDaysElapsedInVoxel(newEnabledVoxel, 1), surface);
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
