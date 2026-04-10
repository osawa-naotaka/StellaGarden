import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.bonfire,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_076.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.bonfire);
    },
});

registerItem({
    itemId: "bonfire",
    spriteName: "ss_sprite_076.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.bonfire,
        entitySize: { w: 1, h: 1 },
        fieldSpriteName: "ss_sprite_076.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.bonfire, { w: 1, h: 1 });
        },
    },
});
