import type { ChestStorage } from "../../engine/ChestStorage";
import { ENTITY_TYPES, getTerrainTypeFromVoxel } from "../../engine/VoxelDefs";
import { type EntitySpriteInfo, type InteractionContext, registerEntity } from "../EntityRegistry";
import { placeFacility } from "../facilityUtil";
import { registerItem } from "../ItemRegistry";

let chestStorage: ChestStorage | null = null;

/** App.tsx から ChestStorage を注入する。 */
export function setChestStorage(storage: ChestStorage): void {
    chestStorage = storage;
}

registerEntity({
    entityType: ENTITY_TYPES.chest,

    getSprites(): EntitySpriteInfo[] {
        return [["chest.png", 0, 0]];
    },

    onInteract(ctx: InteractionContext): boolean {
        if (ctx.tool !== "axe") return false;
        if (!chestStorage) return false;
        const pos = { x: ctx.surfacePos.x, z: ctx.surfacePos.z };
        if (!chestStorage.isEmpty(pos)) return false;
        const terrain = getTerrainTypeFromVoxel(ctx.voxel);
        ctx.voxelMap.set(BigInt(terrain), ctx.surfacePos);
        ctx.inventory.addItems([{ itemId: "chest", count: 1 }]);
        chestStorage.remove(pos);
        return true;
    },

    onOpenFacilityUI(ctx: InteractionContext): boolean {
        ctx.eventBroker.publish("open_chest_ui", { pos: { x: ctx.surfacePos.x, z: ctx.surfacePos.z } });
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
        entitySize: { w: 2, h: 1 },
        fieldSpriteName: "chest.png",
        onPlace(voxelMap, pos) {
            placeFacility(voxelMap, pos, ENTITY_TYPES.chest, { w: 2, h: 1 });
            chestStorage?.create(pos);
        },
    },
});
