/**
 * カテゴリ4（自動処理）施設のエンティティ登録。
 *
 * 対象: auto_thresher
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_processing_auto_ui を発行（UI起動）
 *  - 左クリック (onInteract) + axe → 撤去（ストレージが空のときのみ）
 *
 * 動力: day_changed 時に AutoProcessingStorage.onDailyTick が、隣接する
 *       動力伝達済みシャフトの有無を判定してから一括処理する。
 */
import type { IEventBroker, ItemId, ItemStack, IVoxelWriter, Pos2D } from "../../_boundary/interfaces";
import { defaultPowerConnectionPositions, registerPowerSink } from "../../engine/PowerSinkRegistry";
import { recomputeAllShaftPowerFlow } from "../../engine/ShaftPowerFlow";
import { SlotStorage } from "../../engine/SlotStorage";
import { registerStorageFactory } from "../../engine/StorageVault";
import { ENTITY_TYPES, getEnabledFromVoxel, getEntityTypeFromVoxel, getVariantFromVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { getItemDef, registerItem } from "../ItemRegistry";
import { findRecipeForInput, getAutoProcessingDef, isAcceptableInputItem } from "../ProcessingRecipes";

const DEFAULT_INPUT_SLOTS = 8;
const DEFAULT_OUTPUT_SLOTS = 16;

/**
 * カテゴリ4（自動処理）施設のストレージ。input 8 + output 16 を持つ。
 * 動力（隣接シャフト）が伝達されているときのみ day_changed で一括処理する。
 * 処理内容は voxel entityType から AUTO_PROCESSING_DEFS を引くため全施設で共用する。
 */
export class AutoProcessingStorage extends SlotStorage {
    /** この施設の itemId（例: "auto_thresher"）。auto_processed イベント発行に使う。 */
    private readonly machineItemId: ItemId;

    constructor(machineItemId: ItemId) {
        super({ input: DEFAULT_INPUT_SLOTS, output: DEFAULT_OUTPUT_SLOTS });
        this.machineItemId = machineItemId;
    }

    override onDailyTick(voxelMap: IVoxelWriter, eventBroker?: IEventBroker): void {
        for (const pos of this.getPositions()) {
            const voxel = voxelMap.getSurface(pos);
            const entityType = getEntityTypeFromVoxel(voxel);
            const def = getAutoProcessingDef(entityType);
            if (!def) continue;
            // 動力 OFF なら完全停止（アンカーボクセルの enabled を参照）
            if (!autoProcessingIsPowered(voxel)) continue;

            const slots = this.getSlots(pos);
            if (!slots) continue;

            let processedAny = false;

            // 入力スロットを順に走査して処理
            for (let inputIdx = 0; inputIdx < slots.input.length; inputIdx++) {
                const inputStack = slots.input[inputIdx];
                if (!inputStack) continue;
                if (!isAcceptableInputItem(def, inputStack.itemId as never)) continue;

                const recipe = findRecipeForInput(def, inputStack.itemId as never);
                if (inputStack.count < recipe.inputCountPerCycle) continue;

                // 回せる最大サイクル数 → 出力プールに実際に入る cycles 数（スタック上限を尊重）
                const maxCycles = Math.floor(inputStack.count / recipe.inputCountPerCycle);
                const cycles = calcFeasibleCycles(slots.output, recipe.outputs, maxCycles);
                if (cycles <= 0) continue;

                // 入力消費
                const newCount = inputStack.count - cycles * recipe.inputCountPerCycle;
                this.setSlot(pos, "input", inputIdx, newCount > 0 ? { itemId: inputStack.itemId, count: newCount } : null);

                // 出力プールへ加算
                for (const out of recipe.outputs) {
                    this.addToOutputPool(pos, out.itemId, cycles * out.count);
                }
                processedAny = true;
            }

            // 実際に加工が行われたらミッションシステムへ通知（M-19）
            if (processedAny && eventBroker) {
                eventBroker.publish("auto_processed", { pos, itemId: this.machineItemId });
            }
        }
    }

    /**
     * 出力プールに itemId × count を加算する。
     * 同 itemId の既存スタックに優先してスタックし、満杯なら空きスロットを使う。
     */
    private addToOutputPool(pos: Pos2D, itemId: string, count: number): void {
        const slots = this.getSlots(pos);
        if (!slots) return;
        const outputs = slots.output;
        let remaining = count;
        const max = getItemDef(itemId)?.maxStack ?? 64;

        // まず既存の同 itemId スタックに積む
        for (let i = 0; i < outputs.length && remaining > 0; i++) {
            const slot = outputs[i];
            if (slot === null || slot.itemId !== itemId) continue;
            const space = max - slot.count;
            const add = Math.min(space, remaining);
            this.setSlot(pos, "output", i, { itemId: slot.itemId, count: slot.count + add });
            remaining -= add;
        }
        // 残りを空きスロットに新規追加
        for (let i = 0; i < outputs.length && remaining > 0; i++) {
            if (outputs[i] !== null) continue;
            const add = Math.min(max, remaining);
            this.setSlot(pos, "output", i, { itemId: itemId as ItemStack["itemId"], count: add });
            remaining -= add;
        }
    }
}

interface AutoProcessingEntityOptions {
    entityType: number;
    itemId: ItemId;
    displayName: string;
    getFieldSpriteName: (enabled: boolean, variant: number) => string;
    inventorySpriteName: string;
    entitySize: { w: number; h: number };
}

/** カテゴリ4施設を1つ登録する。 */
export function registerAutoProcessingEntity(opts: AutoProcessingEntityOptions): void {
    const { entityType, itemId, displayName, getFieldSpriteName, inventorySpriteName, entitySize } = opts;

    registerPowerSink({
        entityType,
        getSize: () => entitySize,
        getPowerConnectionPositions: defaultPowerConnectionPositions,
    });

    registerEntity({
        entityType,

        getEntitySize() {
            return entitySize;
        },

        getSprites(voxel: bigint): EntitySpriteInfo[] {
            const variant = getVariantFromVoxel(voxel);
            const enabled = getEnabledFromVoxel(voxel);
            return [[getFieldSpriteName(enabled, variant), 0, 0]];
        },

        // 左クリック: axe による撤去（中身は一緒にインベントリへ回収）
        onInteract(ctx: InteractionContext): boolean {
            if (ctx.tool !== "axe") return false;
            const storage = ctx.storageVault.get<SlotStorage>(itemId);
            const extraItems = storage.collectAllStacks(ctx.anchorPos);
            const removed = removeFacilityByContext(ctx, extraItems);
            if (removed) {
                storage.remove(ctx.anchorPos);
                recomputeAllShaftPowerFlow(ctx.voxelMap);
            }
            return removed;
        },

        // 右クリック: 自動処理 UI を開く
        onOpenFacilityUI(ctx: InteractionContext): boolean {
            ctx.eventBroker.publish("open_processing_auto_ui", { pos: ctx.anchorPos });
            return true;
        },
    });

    registerItem({
        itemId,
        displayName,
        spriteName: inventorySpriteName,
        maxStack: 64,
        placement: {
            entityType,
            getFieldSpriteName: (variant: number) => getFieldSpriteName(false, variant),
            onPlace(voxelMap, pos, _variant, storageVault) {
                placeFacility(voxelMap, pos, entityType, entitySize);
                storageVault.get<SlotStorage>(itemId).create(pos);
                recomputeAllShaftPowerFlow(voxelMap);
            },
        },
    });

    registerStorageFactory(itemId, () => new AutoProcessingStorage(itemId));
}

export function autoProcessingCanAcceptInput(itemId: string, entityType: number): boolean {
    const def = getAutoProcessingDef(entityType);
    if (!def) return false;
    return isAcceptableInputItem(def, itemId as never);
}

// ── 動力状態（UI 向け公開） ──

/** この施設に動力が伝達されているかどうか（アンカーボクセルの enabled を参照）。 */
export function autoProcessingIsPowered(voxel: bigint): boolean {
    return getEnabledFromVoxel(voxel);
}

/**
 * 出力プールへの加算可能な最大サイクル数を計算する。
 * 各出力 itemId に対して同 itemId スタックを統合し、スタック上限を超えないサイクル数を返す。
 */
function calcFeasibleCycles(
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

// ── エンティティ登録 ──
//
// すべて 3x3 タイル（48x48）の水動力機械。
// doc/09 で計画されている専用スプライト（141〜155）は未作成のため、
// 暫定的に手動版のスプライトを流用する。専用スプライトが追加され次第差し替える想定。

// 脱穀機 (sprite 153/154/155 予定 → 手動版 054/063 を暫定流用)
registerAutoProcessingEntity({
    entityType: ENTITY_TYPES.auto_thresher,
    itemId: "auto_thresher",
    displayName: "自動脱穀機",
    getFieldSpriteName: () => "ss_sprite_054.png",
    inventorySpriteName: "ss_sprite_063.png",
    entitySize: { w: 3, h: 3 },
});

// スクリュー式搾油機 (sprite 141/142/143 予定 → 手動版 055/064 を暫定流用)
registerAutoProcessingEntity({
    entityType: ENTITY_TYPES.auto_screw_press,
    itemId: "auto_screw_press",
    displayName: "スクリュー式搾油機",
    getFieldSpriteName: () => "ss_sprite_055.png",
    inventorySpriteName: "ss_sprite_064.png",
    entitySize: { w: 3, h: 3 },
});

// スカッチングミル (sprite 144/145/146 予定 → 手動叩き台 057 を暫定流用)
registerAutoProcessingEntity({
    entityType: ENTITY_TYPES.scutching_mill,
    itemId: "scutching_mill",
    displayName: "スカッチングミル",
    getFieldSpriteName: () => "ss_sprite_057.png",
    inventorySpriteName: "ss_sprite_057.png",
    entitySize: { w: 3, h: 3 },
});

// 紡績機 (sprite 147/148/149 予定 → 手動 紡ぎ車 058/066 を暫定流用)
registerAutoProcessingEntity({
    entityType: ENTITY_TYPES.spinning_machine,
    itemId: "spinning_machine",
    displayName: "紡績機",
    getFieldSpriteName: () => "ss_sprite_058.png",
    inventorySpriteName: "ss_sprite_066.png",
    entitySize: { w: 3, h: 3 },
});

// 自動織機 (sprite 150/151/152 予定 → 手動 織機 059/067 を暫定流用)
registerAutoProcessingEntity({
    entityType: ENTITY_TYPES.auto_loom,
    itemId: "auto_loom",
    displayName: "自動織機",
    getFieldSpriteName: () => "ss_sprite_059.png",
    inventorySpriteName: "ss_sprite_067.png",
    entitySize: { w: 3, h: 3 },
});
