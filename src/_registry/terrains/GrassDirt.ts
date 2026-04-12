/**
 * grass / dirt 地形のインタラクション定義。
 * - shovel: 掘削（地面を1段下げて dirt アイテムを入手）
 * - hoes: 耕作（平坦な地面を soil に変換）
 */
import type { IVoxelWriter } from "../../_boundary/interfaces";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../../engine/TerrainDefs";
import { floodFillWater } from "../../engine/WaterSystem";
import { registerTerrain } from "../TerrainRegistry";

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

/** 中心を削った後（y - 1）でも、3x3 範囲の各セルとの高さ差が 1 以下に収まるか返す。 */
function isSafeToRemove3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number): boolean {
    const centerY = voxelMap.getGroundSurfacePosition({ x: centerX, y: 0, z: centerZ }).y;
    const newCenterY = centerY - 1;
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) return false;
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
                voxelMap.set(TERRAIN_TYPES.dirt, pos);
            }
        }
    }
}

function onGrassDirtInteract(ctx: import("../EntityRegistry").InteractionContext): boolean {
    const { voxelMap, inventory, surfacePos, voxel, tool } = ctx;

    if (tool === "shovel") {
        if (getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none || !isSafeToRemove3x3(voxelMap, surfacePos.x, surfacePos.z)) {
            return false;
        }
        if (surfacePos.y >= 1 && inventory.addItems([{ itemId: "dirt", count: 1 }])) {
            voxelMap.remove(surfacePos);
            revertNearbyInvalidTerrain(voxelMap, surfacePos.x, surfacePos.z);
            floodFillWater(voxelMap, surfacePos.x, surfacePos.z);
            return true;
        }
        return false;
    }

    if (tool === "hoes") {
        if (getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none && isFlat3x3(voxelMap, surfacePos.x, surfacePos.z, surfacePos.y)) {
            voxelMap.set(TERRAIN_TYPES.soil, surfacePos);
            return true;
        }
        return false;
    }

    return false;
}

registerTerrain({
    terrainType: TERRAIN_TYPES.grass,
    onInteract: onGrassDirtInteract,
});

registerTerrain({
    terrainType: TERRAIN_TYPES.dirt,
    onInteract: onGrassDirtInteract,
});
