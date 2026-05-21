import type { ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { findFacilityAnchor } from "../_registry/facilityUtil";
import { getItemDef } from "../_registry/ItemRegistry";
import { KeyedSlotStorage } from "./KeyedSlotStorage";
import { findRecipeForInput, getAutoProcessingDef, isAcceptableInputItem } from "./ProcessingRecipes";
import { ENTITY_TYPES, getEnabledFromVoxel, getEntityTypeFromVoxel } from "./VoxelDefs";

/** 1施設のスロット状態。inputs が入力 8 スロット、outputs が出力 16 スロット。 */
export interface AutoProcessingSlots {
    inputs: (ItemStack | null)[];
    outputs: (ItemStack | null)[];
}

// ---------------------------------------------------------------------------
// 動力判定（拡張ポイント）
// ---------------------------------------------------------------------------

/**
 * 自動加工機の「動力受け入れ位置」を返す。
 * 現状: 施設の外周4辺の全タイル（コーナーを除く）。
 * 将来: _entityType ごとに特定の 2 タイルだけを返すよう変更する想定。
 */
function getPowerConnectionPositions(anchorPos: Pos2D, size: { w: number; h: number }, _entityType: number): Pos2D[] {
    const result: Pos2D[] = [];
    // 上辺・下辺
    for (let dx = 0; dx < size.w; dx++) {
        result.push({ x: anchorPos.x + dx, z: anchorPos.z - 1 });
        result.push({ x: anchorPos.x + dx, z: anchorPos.z + size.h });
    }
    // 左辺・右辺
    for (let dz = 0; dz < size.h; dz++) {
        result.push({ x: anchorPos.x - 1, z: anchorPos.z + dz });
        result.push({ x: anchorPos.x + size.w, z: anchorPos.z + dz });
    }
    return result;
}

function isPoweredShaftAdjacent(voxelMap: IVoxelWriter, anchorPos: Pos2D, size: { w: number; h: number }, entityType: number): boolean {
    for (const p of getPowerConnectionPositions(anchorPos, size, entityType)) {
        if (p.x < 0 || p.z < 0 || p.x >= voxelMap.width || p.z >= voxelMap.depth) continue;
        const surface = voxelMap.getSurfacePosition({ x: p.x, y: 0, z: p.z });
        const v = voxelMap.get(surface);
        if (getEntityTypeFromVoxel(v) !== ENTITY_TYPES.shaft) continue;
        if (getEnabledFromVoxel(v)) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// AutoProcessingStorage
// ---------------------------------------------------------------------------

/**
 * カテゴリ4（自動処理）施設のスロットを座標ベースで管理するストレージ。
 * auto_thresher 等が利用する。
 *
 * `onDailyTick(voxelMap)` で、動力伝達済みシャフトが隣接している施設の
 * 全入力スロットを一括処理する。
 */
export class AutoProcessingStorage extends KeyedSlotStorage<AutoProcessingSlots> {
    private static readonly DEFAULT_INPUT_SLOTS = 8;
    private static readonly DEFAULT_OUTPUT_SLOTS = 16;

    protected createDefaultSlots(): AutoProcessingSlots {
        return {
            inputs: Array<ItemStack | null>(AutoProcessingStorage.DEFAULT_INPUT_SLOTS).fill(null),
            outputs: Array<ItemStack | null>(AutoProcessingStorage.DEFAULT_OUTPUT_SLOTS).fill(null),
        };
    }

    protected isSlotsEmpty(slots: AutoProcessingSlots): boolean {
        return slots.inputs.every((s) => s === null) && slots.outputs.every((s) => s === null);
    }

    protected cloneSlots(slots: AutoProcessingSlots): AutoProcessingSlots {
        return {
            inputs: slots.inputs.map((s) => (s ? { ...s } : null)),
            outputs: slots.outputs.map((s) => (s ? { ...s } : null)),
        };
    }

    // ── 読み取り ──

    getInput(pos: Pos2D, index: number): ItemStack | null {
        return this.getRaw(pos)?.inputs[index] ?? null;
    }

    getOutput(pos: Pos2D, index: number): ItemStack | null {
        return this.getRaw(pos)?.outputs[index] ?? null;
    }

    getInputs(pos: Pos2D): readonly (ItemStack | null)[] {
        return this.getRaw(pos)?.inputs ?? [];
    }

    getOutputs(pos: Pos2D): readonly (ItemStack | null)[] {
        return this.getRaw(pos)?.outputs ?? [];
    }

    // ── 書き込み ──

    setInput(pos: Pos2D, index: number, stack: ItemStack | null, _voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.inputs[index] = stack;
    }

    setOutput(pos: Pos2D, index: number, stack: ItemStack | null, _voxelMap: IVoxelWriter): void {
        const slots = this.getRaw(pos);
        if (!slots) return;
        slots.outputs[index] = stack;
    }

    // ── 受理判定 ──

    /** レシピの inputItemId と一致する itemId のみ受理する。 */
    canAcceptInput(pos: Pos2D, itemId: string, voxelMap: IVoxelWriter): boolean {
        const entityType = this.getEntityTypeAt(pos, voxelMap);
        const def = getAutoProcessingDef(entityType);
        if (!def) return false;
        return isAcceptableInputItem(def, itemId as never);
    }

    // ── 動力状態（UI 向け公開） ──

    /** この施設に動力伝達済みシャフトが隣接しているかどうか。 */
    isPowered(pos: Pos2D, voxelMap: IVoxelWriter): boolean {
        try {
            const anchor = findFacilityAnchor(voxelMap, pos.x, pos.z);
            return isPoweredShaftAdjacent(voxelMap, { x: anchor.anchorX, z: anchor.anchorZ }, anchor.size, anchor.entityType);
        } catch {
            return false;
        }
    }

    // ── 日次処理 ──

    override onDailyTick(voxelMap: IVoxelWriter): void {
        for (const [key] of this.entries()) {
            const pos = this.posFromKey(key);

            // アンカーを解決して entityType と size を取得
            let anchor: ReturnType<typeof findFacilityAnchor>;
            try {
                anchor = findFacilityAnchor(voxelMap, pos.x, pos.z);
            } catch {
                continue;
            }
            const { entityType, size } = anchor;
            const anchorPos: Pos2D = { x: anchor.anchorX, z: anchor.anchorZ };

            // 自動処理定義を取得
            const def = getAutoProcessingDef(entityType);
            if (!def) continue;

            // 動力 OFF なら完全停止
            if (!isPoweredShaftAdjacent(voxelMap, anchorPos, size, entityType)) continue;

            // アンカー座標のスロットを使用（pos はアンカーの可能性があるが念のため anchorPos で取得）
            const slots = this.getRaw(anchorPos);
            if (!slots) continue;

            // 入力スロットを順に走査して処理
            for (let inputIdx = 0; inputIdx < slots.inputs.length; inputIdx++) {
                const inputStack = slots.inputs[inputIdx];
                if (!inputStack) continue;

                const itemId = inputStack.itemId;
                if (!isAcceptableInputItem(def, itemId as never)) continue;

                const recipe = findRecipeForInput(def, itemId as never);
                if (inputStack.count < recipe.inputCountPerCycle) continue;

                // 回せる最大サイクル数
                const maxCycles = Math.floor(inputStack.count / recipe.inputCountPerCycle);

                // 出力プールに実際に入る cycles 数を計算（出力スタック上限を尊重）
                const cycles = this.calcFeasibleCycles(slots.outputs, recipe.outputs, maxCycles);
                if (cycles <= 0) continue;

                // 入力消費
                inputStack.count -= cycles * recipe.inputCountPerCycle;
                if (inputStack.count <= 0) slots.inputs[inputIdx] = null;

                // 出力プールへ加算
                for (const out of recipe.outputs) {
                    this.addToOutputPool(slots.outputs, out.itemId, cycles * out.count);
                }
            }
        }
    }

    // ── private ヘルパー ──

    private getEntityTypeAt(pos: Pos2D, voxelMap: IVoxelWriter): number {
        const surface = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        return getEntityTypeFromVoxel(voxelMap.get(surface));
    }

    /**
     * 出力プールへの加算可能な最大サイクル数を計算する。
     * 各出力 itemId に対して同 itemId スタックを統合し、スタック上限を超えないサイクル数を返す。
     */
    private calcFeasibleCycles(
        outputs: (ItemStack | null)[],
        recipeOutputs: ReadonlyArray<{ readonly itemId: string; readonly count: number }>,
        maxCycles: number,
    ): number {
        let cycles = maxCycles;
        for (const out of recipeOutputs) {
            const max = getItemDef(out.itemId)?.maxStack ?? 64;
            // 現在の出力プールで同 itemId のスロットの合計空き容量を求める
            let totalCapacity = 0;
            let hasMatchingSlot = false;
            for (const slot of outputs) {
                if (slot === null) {
                    totalCapacity += max;
                } else if (slot.itemId === out.itemId) {
                    totalCapacity += max - slot.count;
                    hasMatchingSlot = true;
                }
            }
            // 同 itemId スロットがなく空きスロットもない場合は 0
            if (!hasMatchingSlot && totalCapacity === 0) return 0;
            // このアウトプット種別で許容できるサイクル数
            if (out.count > 0) {
                const feasible = Math.floor(totalCapacity / out.count);
                cycles = Math.min(cycles, feasible);
            }
        }
        return Math.max(0, cycles);
    }

    /**
     * 出力プールに itemId × count を加算する。
     * 同 itemId の既存スタックに優先してスタックし、満杯なら空きスロットを使う。
     */
    private addToOutputPool(outputs: (ItemStack | null)[], itemId: string, count: number): void {
        let remaining = count;
        const max = getItemDef(itemId)?.maxStack ?? 64;

        // まず既存の同 itemId スタックに積む
        for (let i = 0; i < outputs.length && remaining > 0; i++) {
            const slot = outputs[i];
            if (slot === null || slot.itemId !== itemId) continue;
            const space = max - slot.count;
            const add = Math.min(space, remaining);
            slot.count += add;
            remaining -= add;
        }

        // 残りを空きスロットに新規追加
        for (let i = 0; i < outputs.length && remaining > 0; i++) {
            if (outputs[i] !== null) continue;
            const add = Math.min(max, remaining);
            outputs[i] = { itemId: itemId as never, count: add };
            remaining -= add;
        }
        // remaining > 0 の場合は出力満杯（calcFeasibleCycles で 0 になっているはずなので到達しないはず）
    }
}
