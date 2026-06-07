import { clearEntityTypeInVoxel, ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.clay,

    getEntitySize() {
        return { w: 1, h: 1 };
    },

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_086.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "shovel") return false;
        if (!ctx.inventory.addItems([{ itemId: "clay", count: 1 }])) return false;
        ctx.voxelMap.set(clearEntityTypeInVoxel(ctx.voxel), ctx.interactPos);
        return true;
    },
});

registerItem({ itemId: "clay", displayName: "粘土", spriteName: "ss_sprite_080.png", maxStack: 64 });
