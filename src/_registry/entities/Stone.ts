import { ENTITY_TYPES, TERRAIN_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.stone,

    getSprites(): EntitySpriteInfo[] {
        return [["stone1.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        ctx.voxelMap.set(TERRAIN_TYPES.dirt, ctx.surfacePos);
        if (!ctx.inventory.addItems([{ itemId: "stone", count: 1 }])) return false;
        return true;
    },
});

registerItem({ itemId: "stone", spriteName: "stone-icon.png", maxStack: 64 });
