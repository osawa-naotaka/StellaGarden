import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

const ANVIL_SPRITE = "ss_sprite_079.png";

registerEntity({
    entityType: ENTITY_TYPES.anvil,

    getSprites(): EntitySpriteInfo[] {
        return [[ANVIL_SPRITE, 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.anvil);
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "hot_meteoric_iron") return false;
        if (!ctx.inventory.addItems([{ itemId: "blade", count: 1 }])) return false;
        ctx.inventory.consumeSelectedItem(1);
        return true;
    },
});

registerItem({
    itemId: "anvil",
    spriteName: ANVIL_SPRITE,
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.anvil,
        entitySize: { w: 1, h: 1 },
        fieldSpriteName: ANVIL_SPRITE,
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.anvil, { w: 1, h: 1 });
        },
    },
});
