import type { ItemId } from "../../engine/ItemDefs";
import { FERTILIZER_TYPES, getFertilizerTypeFromVoxel, getTerrainTypeFromVoxel, setFertilizerTypeInVoxel, TERRAIN_TYPES } from "../../engine/VoxelDefs";
import { registerItem } from "../ItemRegistry";

function registerFertilizer(itemId: ItemId, displayName: string, fertType: number, spriteName: string): void {
    registerItem({
        itemId,
        displayName,
        spriteName,
        maxStack: 64,
        onItemUse(ctx) {
            const terrainType = getTerrainTypeFromVoxel(ctx.voxel);
            if (
                (terrainType === TERRAIN_TYPES.soil || terrainType === TERRAIN_TYPES.wetSoil) &&
                getFertilizerTypeFromVoxel(ctx.voxel) === 0 &&
                ctx.inventory.consumeSelectedItem(1)
            ) {
                ctx.voxelMap.set(setFertilizerTypeInVoxel(ctx.voxel, fertType), ctx.interactPos);
                return true;
            }
            return false;
        },
    });
}

registerFertilizer("compost", "堆肥", FERTILIZER_TYPES.compost, "ss_sprite_042.png");
registerFertilizer("plant_ashes", "草木灰", FERTILIZER_TYPES.plant_ashes, "ss_sprite_043.png");
registerFertilizer("oil_cake", "油粕", FERTILIZER_TYPES.oil_cake, "ss_sprite_044.png");
