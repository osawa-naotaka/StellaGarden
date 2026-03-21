import { ENTITY_TYPES, TERRAIN_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";

registerEntity({
    entityType: ENTITY_TYPES.stone,

    getSprites(): EntitySpriteInfo[] {
        return [["stone1.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        ctx.voxelMap.set(TERRAIN_TYPES.dirt, ctx.surfacePos);
        ctx.inventory.addItem("stone", 1);
        return true;
    },
});
