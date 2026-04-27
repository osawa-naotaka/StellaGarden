import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.loom,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_059.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.loom);
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        const num_consume = 8;
        if (ctx.tool !== "thread") return false;
        if (!ctx.inventory.canConsumeSelectedItem(num_consume)) return false;
        if (!ctx.inventory.addItems([{ itemId: "cloth", count: 1 }])) return false;
        ctx.inventory.consumeSelectedItem(num_consume);
        return true;
    },
});

registerItem({
    itemId: "loom",
    spriteName: "ss_sprite_067.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.loom,
        entitySize: { w: 2, h: 2 },
        fieldSpriteName: "ss_sprite_059.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.loom, { w: 2, h: 2 });
        },
    },
});
