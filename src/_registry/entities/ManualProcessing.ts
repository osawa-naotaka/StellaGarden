/**
 * カテゴリ2（手動処理）施設のエンティティ登録。
 *
 * 対象: threshing_machine / screw_presses / scutching_board / spinning_wheel / loom / anvil
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_processing_manual_ui を発行（UI起動）
 *  - 左クリック (onInteract) + axe → 撤去（ストレージが空のときのみ）
 */
import type { ItemId } from "../../_boundary/interfaces";
import type { ManualProcessingStorage } from "../../engine/ManualProcessingStorage";
import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

let manualProcessingStorage: ManualProcessingStorage | null = null;

/** App / hooks 層から ManualProcessingStorage を注入する。 */
export function setManualProcessingStorage(storage: ManualProcessingStorage): void {
    manualProcessingStorage = storage;
}

interface ManualProcessingEntityOptions {
    entityType: number;
    itemId: ItemId;
    displayName: string;
    fieldSpriteName: string;
    inventorySpriteName?: string;
    entitySize: { w: number; h: number };
}

/** カテゴリ2施設を1つ登録する。 */
export function registerManualProcessingEntity(opts: ManualProcessingEntityOptions): void {
    const { entityType, itemId, displayName, fieldSpriteName, inventorySpriteName, entitySize } = opts;

    registerEntity({
        entityType,

        getEntitySize() { return entitySize },

        getSprites(): EntitySpriteInfo[] {
            return [[fieldSpriteName, 0, 0]];
        },

        // 左クリック: axe による撤去（storage が空のときのみ）
        onInteract(ctx: InteractionContext): boolean {
            if (ctx.tool !== "axe") return false;
            const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
            if (anchor.entityType !== entityType) throw new Error("anchor entity type mismatch");
            const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
            if (manualProcessingStorage && !manualProcessingStorage.isEmpty(anchorPos)) return false;
            const removed = removeFacility(ctx.voxelMap, ctx.inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType, 0);
            if (removed) manualProcessingStorage?.remove(anchorPos);
            return removed;
        },

        // 右クリック: 処理 UI を開く
        onOpenFacilityUI(ctx: InteractionContext): boolean {
            const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
            if (anchor.entityType !== entityType) throw new Error("anchor entity type mismatch");
            const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
            // 念のためストレージを保証（既存施設のロード後など）
            manualProcessingStorage?.create(anchorPos);
            ctx.eventBroker.publish("open_processing_manual_ui", { pos: anchorPos });
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
                manualProcessingStorage?.create(pos);
            },
        },
    });
}

// ── 移行済みエンティティの登録 ──
// 同一 entityType を facilities.ts と本ファイルで二重登録すると後勝ちで上書きされるため、
// 本ファイルで登録するエンティティは facilities.ts 側から必ず削除すること。

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.threshing_machine,
    itemId: "threshing_machine",
    displayName: "脱穀機",
    fieldSpriteName: "ss_sprite_054.png",
    inventorySpriteName: "ss_sprite_063.png",
    entitySize: { w: 2, h: 1 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.screw_presses,
    itemId: "screw_presses",
    displayName: "搾油機",
    fieldSpriteName: "ss_sprite_055.png",
    inventorySpriteName: "ss_sprite_064.png",
    entitySize: { w: 2, h: 2 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.scutching_board,
    itemId: "scutching_board",
    displayName: "叩き台",
    fieldSpriteName: "ss_sprite_057.png",
    inventorySpriteName: "ss_sprite_057.png",
    entitySize: { w: 1, h: 1 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.spinning_wheel,
    itemId: "spinning_wheel",
    displayName: "紡ぎ車",
    fieldSpriteName: "ss_sprite_058.png",
    inventorySpriteName: "ss_sprite_066.png",
    entitySize: { w: 2, h: 1 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.loom,
    itemId: "loom",
    displayName: "織機",
    fieldSpriteName: "ss_sprite_059.png",
    inventorySpriteName: "ss_sprite_067.png",
    entitySize: { w: 2, h: 2 },
});

registerManualProcessingEntity({
    entityType: ENTITY_TYPES.anvil,
    itemId: "anvil",
    displayName: "金床",
    fieldSpriteName: "ss_sprite_079.png",
    inventorySpriteName: "ss_sprite_079.png",
    entitySize: { w: 1, h: 1 },
});
