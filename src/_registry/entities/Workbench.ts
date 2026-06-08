import { SlotStorage } from "../../engine/SlotStorage";
import { registerStorageFactory } from "../../engine/StorageVault";
import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.workbench,

    getEntitySize() {
        return { w: 2, h: 1 };
    },

    getSprites(): EntitySpriteInfo[] {
        return [["ss_sprite_004.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const workbench = ctx.storageVault.get<SlotStorage>("workbench");
        const extraItems = workbench.collectAllStacks(ctx.anchorPos);
        const removed = removeFacilityByContext(ctx, extraItems);
        if (removed) workbench.remove(ctx.anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_craft_ui", { pos: ctx.anchorPos });
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
        onPlace(voxelMap, pos, _variant, storageVault) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.workbench, { w: 2, h: 1 });
            storageVault.get<SlotStorage>("workbench").create(pos);
        },
    },
});

registerStorageFactory("workbench", () => new SlotStorage({ tool: 1 }));
