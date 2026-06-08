/**
 * カテゴリ3（日次処理）施設のエンティティ登録ヘルパー。
 *
 * 対象: compost_bin / soaking_basket / bonfire / kiln
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_processing_daily_ui を発行（UI起動）
 *  - 左クリック (onInteract) + axe → 撤去（empty 状態かつ storage 空のときのみ）
 *
 * 状態遷移は DailyProcessingStorage が voxel の entityType と growthStage を
 * 自動的に書き換えることで実現する。
 */
import type { ItemId, IVoxelWriter, Pos2D } from "../../_boundary/interfaces";
import { SlotStorage } from "../../engine/SlotStorage";
import { registerStorageFactory } from "../../engine/StorageVault";
import {
    ENTITY_TYPES,
    getDaysElapsedFromVoxel,
    getEnabledFromVoxel,
    getEntityTypeFromVoxel,
    setDaysElapsedInVoxel,
    setEnabledInVoxel,
} from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { getItemDef, registerItem } from "../ItemRegistry";
import { DAILY_PROCESSING_DEFS, findRecipeForInput, getDailyProcessingDef, isAcceptableInputItem } from "../ProcessingRecipes";

/**
 * カテゴリ3（日次処理）施設のストレージ。input 1 + output 2 を持つ。
 * 処理内容は座標の voxel entityType から DAILY_PROCESSING_DEFS を引いて決まるため、
 * 全カテゴリ3施設で本クラスを共用する（itemId ごとにインスタンスを生成）。
 * 進行度は voxel の daysElapsed、完了フラグは enabled ビットに保持する。
 */
export class DailyProcessingStorage extends SlotStorage {
    constructor(outputSlotCount: number) {
        super({ input: 1, output: outputSlotCount });
    }

    override onDailyTick(voxelMap: IVoxelWriter): void {
        for (const pos of this.getPositions()) {
            const surface = voxelMap.getSurfacePosition(pos);
            const voxel = voxelMap.get(surface);
            const entityType = getEntityTypeFromVoxel(voxel);
            // 日次処理対象外の entityType（旧セーブに残った焚き火など）は安全にスキップする。
            const def = DAILY_PROCESSING_DEFS[entityType];
            if (!def) continue;
            const input = this.getSlot(pos, "input", 0);
            if (!input) continue;
            // 受理不可アイテム（出力物が誤って入った等）はレシピ解決で throw するのでスキップ。
            if (!isAcceptableInputItem(def, input.itemId as never)) continue;

            const recipe = findRecipeForInput(def, input.itemId);
            if (input.count < recipe.inputCountPerCycle) continue;

            const daysElapsed = getDaysElapsedFromVoxel(voxel);
            const nextDays = daysElapsed + 1;
            if (nextDays < def.daysRequired + 1) {
                // 進行中
                voxelMap.set(setDaysElapsedInVoxel(voxel, nextDays), surface);
                continue;
            }

            // 完了タイミング: 出力スロットの収まり判定（アトミック）
            let canApply = true;
            for (let i = 0; i < recipe.outputs.length; i++) {
                const out = recipe.outputs[i];
                const slot = this.getSlot(pos, "output", i);
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

            // 入力消費 + 出力加算。完了フラグは enabled ビットに記録する。
            const newInputCount = input.count - recipe.inputCountPerCycle;
            const newEnabledVoxel = setEnabledInVoxel(voxel, true);
            voxelMap.set(setDaysElapsedInVoxel(newEnabledVoxel, newInputCount < recipe.inputCountPerCycle ? 0 : 1), surface);
            this.setSlot(pos, "input", 0, newInputCount > 0 ? { itemId: input.itemId, count: newInputCount } : null);
            for (let i = 0; i < recipe.outputs.length; i++) {
                const out = recipe.outputs[i];
                const slot = this.getSlot(pos, "output", i);
                this.setSlot(
                    pos,
                    "output",
                    i,
                    slot === null ? { itemId: out.itemId, count: out.count } : { itemId: slot.itemId, count: slot.count + out.count },
                );
            }
        }
    }
}

interface DailyProcessingEntityOptions {
    /** empty 状態 = ベース entityType。 */
    baseEntityType: number;
    /** 状態ごとのフィールドスプライト名（または関数）。 */
    sprites: (voxel: bigint) => string;
    /** インベントリアイテムの itemId。 */
    itemId: ItemId;
    /** インベントリ表示名。 */
    displayName: string;
    /** インベントリのスプライト名 */
    inventorySpriteName: string;
    /** 配置時の占有タイル数。 */
    entitySize: { w: number; h: number };
}

/** カテゴリ3施設を1つ登録する。 */
export function registerDailyProcessingEntity(opts: DailyProcessingEntityOptions): void {
    const { baseEntityType, sprites, itemId, displayName, inventorySpriteName, entitySize } = opts;

    registerEntity({
        entityType: baseEntityType,

        getEntitySize() {
            return entitySize;
        },

        getSprites(voxel: bigint): EntitySpriteInfo[] {
            const name = sprites(voxel);
            return [[name, 0, 0]];
        },

        // 左クリック: axe 撤去（処理進行中でも可。中身は一緒にインベントリへ回収）
        onInteract(ctx: InteractionContext): boolean {
            if (ctx.tool !== "axe") return false;
            const storage = ctx.storageVault.get<SlotStorage>(itemId);
            const extraItems = storage.collectAllStacks(ctx.anchorPos);
            const removed = removeFacilityByContext(ctx, extraItems);
            if (removed) storage.remove(ctx.anchorPos);
            return removed;
        },

        // 右クリック: 処理 UI を開く（全状態で可）
        onOpenFacilityUI(ctx: InteractionContext): boolean {
            ctx.eventBroker.publish("open_processing_daily_ui", { pos: ctx.anchorPos });
            return true;
        },
    });

    // 配置時アイテム（empty 状態で配置）
    registerItem({
        itemId,
        displayName,
        spriteName: inventorySpriteName,
        maxStack: 64,
        placement: {
            entityType: baseEntityType,
            fieldSpriteName: sprites(0n),
            onPlace(voxelMap, pos, _variant, storageVault) {
                placeFacility(voxelMap, pos, baseEntityType, entitySize);
                storageVault.get<SlotStorage>(itemId).create(pos);
            },
        },
    });

    const outputSlotCount = DAILY_PROCESSING_DEFS[baseEntityType]?.outputSlotCount ?? 1;
    registerStorageFactory(itemId, () => new DailyProcessingStorage(outputSlotCount));
}

function getBaseEntityTypeAt(pos: Pos2D, voxelMap: IVoxelWriter): number {
    const surface = voxelMap.getSurfacePosition(pos);
    return getEntityTypeFromVoxel(voxelMap.get(surface));
}

export function dailyProcessingCanAcceptInput(pos: Pos2D, itemId: string, voxelMap: IVoxelWriter): boolean {
    const baseEntityType = getBaseEntityTypeAt(pos, voxelMap);
    if (baseEntityType === ENTITY_TYPES.none) return false;
    const def = getDailyProcessingDef(baseEntityType);
    if (!def) return false;
    return isAcceptableInputItem(def, itemId as never);
}

export function getDaysElapsed(pos: Pos2D, voxelMap: IVoxelWriter): number {
    const surface = voxelMap.getSurfacePosition(pos);
    return getDaysElapsedFromVoxel(voxelMap.get(surface));
}

// ── 移行済みエンティティの登録 ──

// アニメーションスプライトの共通フレーム時間
const ANIM_FRAME_MS = 300;

const KILN_BURNING_FRAMES = ["ss_sprite_078_1.png", "ss_sprite_078_2.png", "ss_sprite_078_3.png"];
function kilnBurningFrame(): string {
    return KILN_BURNING_FRAMES[Math.floor(Date.now() / ANIM_FRAME_MS) % KILN_BURNING_FRAMES.length];
}

// compost_bin: 4状態すべて固有のスプライトを持つ
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.compost_bin,
    sprites: (voxel) => {
        const days = getDaysElapsedFromVoxel(voxel);
        if (getEnabledFromVoxel(voxel)) {
            return "ss_sprite_053_3.png";
        }
        switch (days) {
            case 0:
                return "ss_sprite_071.png";
            case 1:
                return "ss_sprite_053_1.png";
            case 2:
                return "ss_sprite_053_2.png";
            case 3:
                return "ss_sprite_053_2.png";
            case 4:
                return "ss_sprite_053_2.png";
            default:
                return "ss_sprite_053_3.png";
        }
    },
    itemId: "compost_bin",
    displayName: "堆肥場",
    inventorySpriteName: "ss_sprite_062.png",
    entitySize: { w: 2, h: 2 },
});

// soaking_basket は独立実装に移行（_registry/entities/SoakingBasket.ts）。
// 縦横バリアントと水隣接判定を持つため、registerDailyProcessingEntity の枠から外れる。

// bonfire は炉型に拡張され独立実装に移行（_registry/entities/Bonfire.ts）。
// 燃料スロット＋素材スロットを持ち BonfireStorage が処理するため、汎用ヘルパーの枠から外れる。

// kiln: loading と progressing は kiln_burning（アニメーション）。
// 完了時は empty と同じ kiln スプライトに戻り、output から charcoal + dirt を取り出す。
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.kiln,
    sprites: (voxel) => {
        const days = getDaysElapsedFromVoxel(voxel);
        switch (days) {
            case 0:
                return "ss_sprite_077.png";
            case 1:
            case 2:
            case 3:
            case 4:
                return kilnBurningFrame();
            case 5:
                return "ss_sprite_077.png";
            default:
                return "ss_sprite_077.png";
        }
    },
    itemId: "kiln",
    displayName: "炭焼き窯",
    inventorySpriteName: "ss_sprite_068.png",
    entitySize: { w: 2, h: 2 },
});

// koji_muro（麹室・doc/26 §3.3）: 蒸麦 → 麹。スプライト未作成のため 2x2 の堆肥場を流用する。
registerDailyProcessingEntity({
    baseEntityType: ENTITY_TYPES.koji_muro,
    sprites: (voxel) => {
        const days = getDaysElapsedFromVoxel(voxel);
        if (getEnabledFromVoxel(voxel)) {
            return "ss_sprite_053_3.png"; // 完了（麹あり）
        }
        switch (days) {
            case 0:
                return "ss_sprite_071.png"; // 空
            case 1:
                return "ss_sprite_053_1.png";
            default:
                return "ss_sprite_053_2.png"; // 発酵中
        }
    },
    itemId: "koji_muro",
    displayName: "麹室",
    inventorySpriteName: "ss_sprite_062.png",
    entitySize: { w: 2, h: 2 },
});
