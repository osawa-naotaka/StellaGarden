import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.forge,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_069.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.forge);
    },
});

registerItem({
    itemId: "forge",
    spriteName: "ss_sprite_052.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.forge,
        entitySize: { w: 2, h: 2 },
        fieldSpriteName: "ss_sprite_069.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.forge, { w: 2, h: 2 });
        },
    },
});
