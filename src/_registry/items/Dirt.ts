import type { IVoxelWriter } from "../../_boundary/interfaces";
import { recomputeAllPipeWaterFlow } from "../../engine/PipeWaterFlow";
import { getTerrainTypeFromVoxel, initializeVoxel, TERRAIN_TYPES } from "../../engine/TerrainDefs";
import { removeDisconnectedWater } from "../../engine/WaterSystem";
import { registerItem } from "../ItemRegistry";

/** 中心に土を盛った後（y + 1）でも、3x3 範囲の各セルとの高さ差が 1 以下に収まるか返す。 */
function isSafeToAdd3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number): boolean {
    const centerY = voxelMap.getGroundSurfacePosition({ x: centerX, y: 0, z: centerZ }).y;
    const newCenterY = centerY + 1;
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            const y = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz }).y;
            if (Math.abs(newCenterY - y) > 1) return false;
        }
    }
    return true;
}

/** 高さ変化によって isFlat3x3 条件が崩れた近傍 soil/wetSoil タイルを dirt に戻す。 */
function revertNearbyInvalidTerrain(voxelMap: IVoxelWriter, cx: number, cz: number): void {
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
            const pos = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz });
            const terrain = getTerrainTypeFromVoxel(voxelMap.get(pos));
            if (isFlat3x3(voxelMap, nx, nz, pos.y)) continue;
            if (terrain === TERRAIN_TYPES.soil || terrain === TERRAIN_TYPES.wetSoil) {
                voxelMap.set(BigInt(TERRAIN_TYPES.dirt), pos);
            }
        }
    }
}

/** 3x3 範囲の表面 y がすべて同じかどうかを返す。 */
function isFlat3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number, centerY: number): boolean {
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) return false;
            if (voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz }).y !== centerY) return false;
        }
    }
    return true;
}

registerItem({
    itemId: "dirt",
    displayName: "土",
    spriteName: "ss_sprite_046.png",
    maxStack: 64,
    onItemUse(ctx) {
        // 水タイルを無視して地面の高さを取得し、地面の1つ上に dirt を配置する
        const groundPos = ctx.voxelMap.getGroundSurfacePosition({ x: ctx.surfacePos.x, y: 0, z: ctx.surfacePos.z });
        const groundVoxel = ctx.voxelMap.get(groundPos);
        const groundTerrainType = getTerrainTypeFromVoxel(groundVoxel);
        const surfaceTerrainType = getTerrainTypeFromVoxel(ctx.voxel);
        const isWaterSurface = surfaceTerrainType === TERRAIN_TYPES.waterSource;
        if (
            (isWaterSurface || groundTerrainType === TERRAIN_TYPES.grass || groundTerrainType === TERRAIN_TYPES.dirt) &&
            groundPos.y + 1 < ctx.voxelMap.height &&
            (isWaterSurface || isSafeToAdd3x3(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z)) &&
            ctx.inventory.consumeSelectedItem(1)
        ) {
            ctx.voxelMap.set(initializeVoxel(TERRAIN_TYPES.dirt), { x: groundPos.x, y: groundPos.y + 1, z: groundPos.z });
            revertNearbyInvalidTerrain(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
            removeDisconnectedWater(ctx.voxelMap, ctx.surfacePos.x, ctx.surfacePos.z);
            recomputeAllPipeWaterFlow(ctx.voxelMap);
            return true;
        }
        return false;
    },
});
