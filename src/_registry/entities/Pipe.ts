import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";


registerEntity({
    entityType: ENTITY_TYPES.pipe,

    getSprites(): EntitySpriteInfo[] {
        return [["pipe1_h", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.pipe);
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "hot_meteoric_iron") return false;
        if (!ctx.inventory.addItems([{ itemId: "blade", count: 1 }])) return false;
        ctx.inventory.consumeSelectedItem(1);
        return true;
    },
});

registerItem({
    itemId: "pipe",
    spriteName: "pipe1_h",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.pipe,
        entitySize: { w: 1, h: 1 },
        fieldSpriteName: "pipe1_h",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.pipe, { w: 1, h: 1 });
        },
    },
});
