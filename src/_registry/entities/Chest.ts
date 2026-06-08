import { SlotStorage } from "../../engine/SlotStorage";
import { registerStorageFactory } from "../../engine/StorageVault";
import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility, removeFacilityByContext } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

registerEntity({
    entityType: ENTITY_TYPES.chest,

    getEntitySize() {
        return { w: 2, h: 1 };
    },

    getSprites(): EntitySpriteInfo[] {
        return [["chest.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        const chest = ctx.storageVault.get<SlotStorage>("chest");
        const extraItems = chest.collectAllStacks(ctx.anchorPos);
        const removed = removeFacilityByContext(ctx, extraItems);
        if (removed) chest.remove(ctx.anchorPos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_chest_ui", { pos: ctx.anchorPos });
        return true;
    },
});

registerItem({
    itemId: "chest",
    displayName: "チェスト",
    spriteName: "chest.png",
    maxStack: 64,
    placement: {
        entityType: ENTITY_TYPES.chest,
        fieldSpriteName: "chest.png",
        onPlace(voxelMap, pos, _variant, storageVault) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.chest, { w: 2, h: 1 });
            storageVault.get<SlotStorage>("chest").create(pos);
        },
    },
});

const CHEST_SLOT_COUNT = 64;

registerStorageFactory("chest", () => new SlotStorage({ main: CHEST_SLOT_COUNT }));
