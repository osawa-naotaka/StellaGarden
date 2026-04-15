import { ENTITY_TYPES, initializeVoxel, TERRAIN_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.stone,

    getSprites(): EntitySpriteInfo[] {
        return [["stone1.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "pickaxe") return false;
        ctx.voxelMap.set(initializeVoxel(TERRAIN_TYPES.dirt), ctx.surfacePos);
        if (!ctx.inventory.addItems([{ itemId: "stone", count: 1 }])) return false;
        return true;
    },
});

registerItem({ itemId: "stone", spriteName: "stone-icon.png", maxStack: 64 });
