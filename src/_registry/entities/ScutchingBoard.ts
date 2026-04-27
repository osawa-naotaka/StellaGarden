import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

const SCUTCHING_BOARD_SPRITE = "ss_sprite_057.png";

registerEntity({
    entityType: ENTITY_TYPES.scutching_board,

    getSprites(): EntitySpriteInfo[] {
        return [[SCUTCHING_BOARD_SPRITE, 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.scutching_board);
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "processed_flax") return false;
        if (!ctx.inventory.addItems([{ itemId: "flax_fiber", count: 1 }])) return false;
        ctx.inventory.consumeSelectedItem(1);
        return true;
    },
});

registerItem({
    itemId: "scutching_board",
    spriteName: SCUTCHING_BOARD_SPRITE,
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.scutching_board,
        entitySize: { w: 1, h: 1 },
        fieldSpriteName: SCUTCHING_BOARD_SPRITE,
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.scutching_board, { w: 1, h: 1 });
        },
    },
});
