import { getTerrainTypeFromVoxel, setTerrainTypeInVoxel, TERRAIN_TYPES } from "../../engine/VoxelDefs";
import { registerItem } from "../ItemRegistry";

registerItem({
    itemId: "watering_can",
    displayName: "じょうろ",
    spriteName: "water_can.png",
    maxStack: 1,
    onItemUse(ctx) {
        if (getTerrainTypeFromVoxel(ctx.voxel) !== TERRAIN_TYPES.soil) return false;
        ctx.voxelMap.set(setTerrainTypeInVoxel(ctx.voxel, TERRAIN_TYPES.wetSoil), ctx.surfacePos);
        return true;
    },
});
