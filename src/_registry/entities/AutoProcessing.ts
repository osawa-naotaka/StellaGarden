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
import type { ItemId } from "../../_boundary/interfaces";
import type { AutoProcessingStorage } from "../../engine/AutoProcessingStorage";
import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

let autoProcessingStorage: AutoProcessingStorage | null = null;

/** App / hooks 層から AutoProcessingStorage を注入する。 */
export function setAutoProcessingStorage(storage: AutoProcessingStorage): void {
    autoProcessingStorage = storage;
}

interface AutoProcessingEntityOptions {
    entityType: number;
    itemId: ItemId;
    displayName: string;
    fieldSpriteName: string;
    inventorySpriteName?: string;
    entitySize: { w: number; h: number };
}

/** カテゴリ4施設を1つ登録する。 */
export function registerAutoProcessingEntity(opts: AutoProcessingEntityOptions): void {
    const { entityType, itemId, displayName, fieldSpriteName, inventorySpriteName, entitySize } = opts;

    registerEntity({
        entityType,

        getEntitySize() {
            return entitySize;
        },

        getSprites(): EntitySpriteInfo[] {
            return [[fieldSpriteName, 0, 0]];
        },

        // 左クリック: axe による撤去（storage が空のときのみ）
        onInteract(ctx: InteractionContext): boolean {
            if (ctx.tool !== "axe") return false;
            const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
            if (anchor.entityType !== entityType) throw new Error("anchor entity type mismatch");
            const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
            if (autoProcessingStorage && !autoProcessingStorage.isEmpty(anchorPos)) return false;
            const removed = removeFacility(ctx.voxelMap, ctx.inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType, 0);
            if (removed) autoProcessingStorage?.remove(anchorPos);
            return removed;
        },

        // 右クリック: 自動処理 UI を開く
        onOpenFacilityUI(ctx: InteractionContext): boolean {
            const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
            if (anchor.entityType !== entityType) throw new Error("anchor entity type mismatch");
            const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
            // 念のためストレージを保証（既存施設のロード後など）
            autoProcessingStorage?.create(anchorPos);
            ctx.eventBroker.publish("open_processing_auto_ui", { pos: anchorPos });
            return true;
        },
    });

    registerItem({
        itemId,
        displayName,
        spriteName: inventorySpriteName ?? fieldSpriteName,
        maxStack: 64,
        placement: {
            entityType,
            fieldSpriteName,
            onPlace(voxelMap, pos) {
                placeFacility(voxelMap, pos, entityType, entitySize);
                autoProcessingStorage?.create(pos);
            },
        },
    });
}

// ── エンティティ登録 ──

// 暫定スプライト: 手動脱穀機のスプライトを流用（後で専用スプライトに差し替え可能）
registerAutoProcessingEntity({
    entityType: ENTITY_TYPES.auto_thresher,
    itemId: "auto_thresher",
    displayName: "自動脱穀機",
    fieldSpriteName: "ss_sprite_054.png",
    inventorySpriteName: "ss_sprite_063.png",
    entitySize: { w: 3, h: 3 },
});
