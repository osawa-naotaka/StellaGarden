import { clearEntityTypeInVoxel, ENTITY_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.clay,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_086.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "shovel") return false;
        if (!ctx.inventory.addItems([{ itemId: "clay", count: 1 }])) return false;
        ctx.voxelMap.set(clearEntityTypeInVoxel(ctx.voxel), ctx.surfacePos);
        return true;
    },
});

registerItem({ itemId: "clay", spriteName: "ss_sprite_080.png", maxStack: 64 });
