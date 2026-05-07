import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import type { WorkbenchStorage } from "../../engine/WorkbenchStorage";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

let workbenchStorage: WorkbenchStorage | null = null;

/** App.tsx から WorkbenchStorage を注入する。 */
export function setWorkbenchStorage(storage: WorkbenchStorage): void {
    workbenchStorage = storage;
}

function resolveWorkbenchAnchor(ctx: InteractionContext): { x: number; z: number } | null {
    const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
    if (!anchor) return null;
    return { x: anchor.anchorX, z: anchor.anchorZ };
}

registerEntity({
    entityType: ENTITY_TYPES.workbench,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_004.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool === "axe") {
            const anchorPos = resolveWorkbenchAnchor(ctx);
            if (!anchorPos) return false;
            const removed = removeFacilityAtPos(ctx.voxelMap, ctx.inventory, anchorPos.x, anchorPos.z, ENTITY_TYPES.workbench);
            if (removed) {
                workbenchStorage?.remove(anchorPos);
            }
            return removed;
        }
        return false;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        const anchorPos = resolveWorkbenchAnchor(ctx);
        if (!anchorPos) return false;
        ctx.eventBroker.publish("open_craft_ui", {
            pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z },
            workbenchPos: anchorPos,
        });
        return true;
    },
});

registerItem({
    itemId: "workbench",
    displayName: "作業台",
    spriteName: "ss_sprite_003.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.workbench,
        entitySize: { w: 2, h: 1 },
        fieldSpriteName: "ss_sprite_004.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.workbench, { w: 2, h: 1 });
            workbenchStorage?.create(pos);
        },
    },
});
