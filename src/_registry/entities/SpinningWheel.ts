import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.spinning_wheel,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_058.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.spinning_wheel);
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "flax_fiber") return false;
        if (!ctx.inventory.addItems([{ itemId: "thread", count: 1 }])) return false;
        ctx.inventory.consumeSelectedItem(1);
        return true;
    },
});

registerItem({
    itemId: "spinning_wheel",
    spriteName: "ss_sprite_066.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.spinning_wheel,
        entitySize: { w: 1, h: 1 },
        fieldSpriteName: "ss_sprite_058.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.spinning_wheel, { w: 2, h: 1 });
        },
    },
});
