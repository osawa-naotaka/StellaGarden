import { ENTITY_TYPES } from "../../engine/TerrainDefs";
import { registerEntity, type EntitySpriteInfo, type InteractionContext } from "../EntityRegistry";
import { placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.workbench,

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_004.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool === "axe") {
            return removeFacilityAtPos(ctx.voxelMap, ctx.inventory, ctx.surfacePos.x, ctx.surfacePos.z, ENTITY_TYPES.workbench);
        }
        return false;
    },

    onPrimaryInteract(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_craft_ui", { pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z } });
        return true;
    },
});

registerItem({
    itemId: "workbench",
    spriteName: "ss_sprite_003.png",
    maxStack: 1,
    placement: {
        entityType: ENTITY_TYPES.workbench,
        entitySize: { w: 2, h: 1 },
        fieldSpriteName: "ss_sprite_004.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.workbench, { w: 2, h: 1 });
        },
    },
});
