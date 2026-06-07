import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";
import { collectAllStacks, createStorage, registerStorage, removeStorage } from "../StorageRegistry";

function resolveWorkbenchAnchor(ctx: InteractionContext): { x: number; z: number } {
    const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
    return { x: anchor.anchorX, z: anchor.anchorZ };
}

registerEntity({
    entityType: ENTITY_TYPES.workbench,

    getEntitySize() {
        return { w: 2, h: 1 };
    },

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_004.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool === "axe") {
            const anchorPos = resolveWorkbenchAnchor(ctx);
            const extraItems = collectAllStacks("workbench", anchorPos) ?? [];
            const removed = removeFacilityAtPos(ctx.voxelMap, ctx.inventory, anchorPos.x, anchorPos.z, ENTITY_TYPES.workbench, extraItems);
            if (removed) {
                removeStorage("workbench", anchorPos);
            }
            return removed;
        }
        return false;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        const anchorPos = resolveWorkbenchAnchor(ctx);
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
        fieldSpriteName: "ss_sprite_004.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.workbench, { w: 2, h: 1 });
            createStorage("workbench", pos);
        },
    },
});

registerStorage("workbench", { tool: [null] });
