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
import { ENTITY_TYPES, getVariantFromVoxel } from "../../engine/VoxelDefs";
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
    getFieldSpriteName: ((variant: number) => string);
    inventorySpriteName: string;
    entitySize: { w: number; h: number };
}

/** カテゴリ4施設を1つ登録する。 */
export function registerAutoProcessingEntity(opts: AutoProcessingEntityOptions): void {
    const { entityType, itemId, displayName, getFieldSpriteName, inventorySpriteName, entitySize } = opts;

    registerEntity({
        entityType,

        getEntitySize() {
            return entitySize;
        },

        getSprites(voxel: bigint): EntitySpriteInfo[] {
            const variant = getVariantFromVoxel(voxel);
            return [[getFieldSpriteName(variant), 0, 0]];
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
        spriteName: inventorySpriteName,
        maxStack: 64,
        placement: {
            entityType,
            getFieldSpriteName,
            onPlace(voxelMap, pos) {
                placeFacility(voxelMap, pos, entityType, entitySize);
                autoProcessingStorage?.create(pos);
            },
        },
    });
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
