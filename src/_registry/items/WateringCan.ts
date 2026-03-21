import { getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../../engine/TerrainDefs";
import { registerItem } from "../ItemRegistry";

registerItem({
    itemId: "watering_can",
    onItemUse(ctx) {
        if (getTerrainTypeFromVoxel(ctx.voxel) !== TERRAIN_TYPES.soil) return false;
        // エンティティビットと growthStage を保持したまま地形タイプのみ wetSoil に変更
        ctx.voxelMap.set((ctx.voxel & ~0xff) | TERRAIN_TYPES.wetSoil, ctx.surfacePos);
        return true;
    },
});
