import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.forge,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_052.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.forge);
    },
});

registerItem({
    itemId: "forge",
    placement: {
        entityType: ENTITY_TYPES.forge,
        entitySize: { w: 1, h: 1 },
        fieldSpriteName: "ss_sprite_052.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.forge, { w: 1, h: 1 });
        },
    },
});
