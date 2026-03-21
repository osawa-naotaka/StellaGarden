import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { removeFacilityAtPos } from "../facilityUtil";

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
