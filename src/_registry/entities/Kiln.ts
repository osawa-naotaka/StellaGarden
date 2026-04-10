import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.kiln,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_077.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.kiln);
    },
});

registerItem({
    itemId: "kiln",
    spriteName: "ss_sprite_068.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.kiln,
        entitySize: { w: 2, h: 2 },
        fieldSpriteName: "ss_sprite_077.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.kiln, { w: 2, h: 2 });
        },
    },
});
