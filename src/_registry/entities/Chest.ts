import { ENTITY_TYPES } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { findFacilityAnchor, placeFacility, removeFacilityAtPos } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";
import { collectAllStacks, createStorage, registerStorage, removeStorage } from "../StorageRegistry";

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
        const pos = { x: ctx.surfacePos.x, z: ctx.surfacePos.z };
        const extraItems = collectAllStacks("chest", pos);
        const removed = removeFacilityAtPos(ctx.voxelMap, ctx.inventory, pos.x, pos.z, ENTITY_TYPES.chest, extraItems);
        if (removed) removeStorage("chest", pos);
        return removed;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        const anchor = findFacilityAnchor(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
        
        ctx.eventBroker.publish("open_chest_ui", { pos: { x: anchor.anchorX, z: anchor.anchorZ } });
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
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.chest, { w: 2, h: 1 });
            createStorage("chest", pos);
        },
    },
});


const CHEST_SLOT_COUNT = 64;

registerStorage("chest", { main: new Array(CHEST_SLOT_COUNT).fill(null) });
