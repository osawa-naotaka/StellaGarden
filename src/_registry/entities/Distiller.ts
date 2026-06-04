/**
 * 蒸留器（distiller）の独立エンティティ登録（doc/26 §3.5）。
 *
 * 焚き火と同じ「燃料スロット＋素材スロット」型で、麦もろみを蒸留して麦焼酎を産出する。
 * 状態管理は DistillerStorage が担い、稼働状態は voxel の enabled ビットで表す。
 * スプライトは未作成のため 2x2 の堆肥場スプライトを流用する。
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_distiller_ui を発行（DistillerPanel 起動）
 *  - 左クリック (onInteract) + axe → 撤去（中身は一緒にインベントリへ回収）
 */
import type { DistillerStorage } from "../../engine/DistillerStorage";
import { ENTITY_TYPES, getEnabledFromVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

const ENTITY_SIZE = { w: 2, h: 2 };

let distillerStorage: DistillerStorage | null = null;

/** App / hooks 層から DistillerStorage を注入する。 */
export function setDistillerStorage(storage: DistillerStorage): void {
    distillerStorage = storage;
}

registerEntity({
    entityType: ENTITY_TYPES.distiller,

    getEntitySize() {
        return ENTITY_SIZE;
    },

    getSprites(voxel: bigint): EntitySpriteInfo[] {
        // 稼働中（燃料＋素材あり）は発酵中、それ以外は空の堆肥場スプライトを流用。
        return getEnabledFromVoxel(voxel) ? [["ss_sprite_053_2.png", 0, 0]] : [["ss_sprite_071.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (anchor.entityType !== ENTITY_TYPES.distiller) throw new Error("anchor entity type mismatch");
        const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
        const extraItems = distillerStorage?.collectAllStacks(anchorPos) ?? [];
        const removed = removeFacility(ctx.voxelMap, ctx.inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType, 0, extraItems);
        if (removed) distillerStorage?.remove(anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
        distillerStorage?.create(anchorPos);
        ctx.eventBroker.publish("open_distiller_ui", { pos: anchorPos });
        return true;
    },
});

registerItem({
    itemId: "distiller",
    displayName: "蒸留器",
    spriteName: "ss_sprite_062.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.distiller,
        fieldSpriteName: "ss_sprite_071.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.distiller, ENTITY_SIZE);
            distillerStorage?.create(pos);
        },
    },
});
