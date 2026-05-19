import { ENTITY_TYPES, placeEntity } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.winch,

    getEntitySize() { return { w: 1, h: 2 }; },

    getSprites(): EntitySpriteInfo[] {
        return [["winch", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        ctx.voxelMap.set(placeEntity(ctx.voxel, ENTITY_TYPES.none), ctx.surfacePos);
        ctx.inventory.addItems([{ itemId: "winch", count: 1 }]);
        return true;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        ctx.eventBroker.publish("open_winch_ui", { pos: { x: anchor.anchorX, z: anchor.anchorZ } });
        return true;
    },
});

registerItem({
    itemId: "winch",
    displayName: "ウインチ",    
    spriteName: "winch",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.winch,
        getFieldSpriteName() { return "winch"; },
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.winch, { w: 1, h: 2 });
        },
    },
});
