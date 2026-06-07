import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";
import { createStorage, registerStorage, removeFacilityAndReturnItemsToInventory, removeStorage } from "../StorageRegistry";

registerEntity({
    entityType: ENTITY_TYPES.workbench,

    getEntitySize() {
        return { w: 2, h: 1 };
    },

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_004.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool === "axe") {
            const removed = removeFacilityAndReturnItemsToInventory("workbench", ctx);
            if (removed) {
                removeStorage("workbench", ctx.anchorPos);
            }
            return removed;
        }
        return false;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_craft_ui", {
            pos: ctx.interactPos,
            workbenchPos: ctx.anchorPos,
        });
        return true;
    },
});

registerItem({
    itemId: "workbench",
    displayName: "作業台",
    spriteName: "ss_sprite_003.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.workbench,
        fieldSpriteName: "ss_sprite_004.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.workbench, { w: 2, h: 1 });
            createStorage("workbench", pos);
        },
    },
});

registerStorage("workbench", { tool: [null] });
