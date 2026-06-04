/**
 * 発酵桶（fermentation_vat）の独立エンティティ登録（doc/26 §3.4）。
 *
 * 多入力の長期熟成設備。味噌・醤油もろみ・麦もろみ・酢・熟成麦焼酎を品目選択して仕込む。
 * 状態管理は FermentationStorage が担う。中身はホバー（プロパティ）で判別する想定。
 * スプライトは未作成のため 1x1 の金床スプライトを流用する。
 *
 * 操作:
 *  - 右クリック (onOpenFacilityUI) → open_fermentation_ui を発行（FermentationPanel 起動）
 *  - 左クリック (onInteract) + axe → 撤去（中身は一緒にインベントリへ回収）
 */
import type { FermentationStorage } from "../../engine/FermentationStorage";
import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

const ENTITY_SIZE = { w: 1, h: 1 };

let fermentationStorage: FermentationStorage | null = null;

/** App / hooks 層から FermentationStorage を注入する。 */
export function setFermentationStorage(storage: FermentationStorage): void {
    fermentationStorage = storage;
}

registerEntity({
    entityType: ENTITY_TYPES.fermentation_vat,

    getEntitySize() {
        return ENTITY_SIZE;
    },

    getSprites(): EntitySpriteInfo[] {
        // スプライト未作成のため金床（1x1）を流用。中身はホバーで判別する想定。
        return [["ss_sprite_079.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        if (anchor.entityType !== ENTITY_TYPES.fermentation_vat) throw new Error("anchor entity type mismatch");
        const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
        const extraItems = fermentationStorage?.collectAllStacks(anchorPos) ?? [];
        const removed = removeFacility(ctx.voxelMap, ctx.inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType, 0, extraItems);
        if (removed) fermentationStorage?.remove(anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        const anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
        fermentationStorage?.create(anchorPos);
        ctx.eventBroker.publish("open_fermentation_ui", { pos: anchorPos });
        return true;
    },
});

registerItem({
    itemId: "fermentation_vat",
    displayName: "発酵桶",
    spriteName: "ss_sprite_079.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.fermentation_vat,
        fieldSpriteName: "ss_sprite_079.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.fermentation_vat, ENTITY_SIZE);
            fermentationStorage?.create(pos);
        },
    },
});
