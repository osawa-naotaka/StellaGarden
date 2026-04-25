import type { IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import {
    ENTITY_TYPES,
    getEntityTypeFromVoxel,
    getPipeConnectionsFromVoxel,
    getTerrainTypeFromVoxel,
    setPipeConnectionsInVoxel,
    TERRAIN_TYPES,
} from "./TerrainDefs";

export const PIPE_CONNECTION_UP = 1 << 0;
export const PIPE_CONNECTION_DOWN = 1 << 1;
export const PIPE_CONNECTION_LEFT = 1 << 2;
export const PIPE_CONNECTION_RIGHT = 1 << 3;

const CARDINAL_DIRS: ReadonlyArray<{
    readonly dx: number;
    readonly dz: number;
    readonly bit: number;
}> = [
    { dx: 0, dz: -1, bit: PIPE_CONNECTION_UP },
    { dx: 0, dz: 1, bit: PIPE_CONNECTION_DOWN },
    { dx: -1, dz: 0, bit: PIPE_CONNECTION_LEFT },
    { dx: 1, dz: 0, bit: PIPE_CONNECTION_RIGHT },
];

/** 指定 voxel が畝間水路エンティティかどうか。 */
export function isPipeVoxel(voxel: bigint): boolean {
    return getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.pipe1;
}

/** 指定 terrain type が水タイルとして接続対象かどうか。 */
export function isWaterTerrainType(terrainType: number): boolean {
    return terrainType === TERRAIN_TYPES.water || terrainType === TERRAIN_TYPES.waterSource;
}

/** 指定座標がマップ範囲内かどうか。 */
function isInBounds(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    return x >= 0 && x < voxelMap.width && z >= 0 && z < voxelMap.depth;
}

/** 指定座標の surface voxel を取得する。範囲外なら null。 */
function getSurfaceVoxelAt(voxelMap: IVoxelWriter, x: number, z: number): bigint | null {
    if (!isInBounds(voxelMap, x, z)) return null;
    const surfacePos = voxelMap.getSurfacePosition({ x, y: 0, z });
    return voxelMap.get(surfacePos);
}

/**
 * 指定タイルの4近傍から、畝間水路の接続マスクを計算する。
 *
 * 現段階では以下を接続対象とする:
 * - 畝間水路エンティティ
 * - 水タイル（water / waterSource）
 */
export function computePipeConnectionMask(voxelMap: IVoxelWriter, pos: Pos2D): number {
    let mask = 0;

    for (const dir of CARDINAL_DIRS) {
        const neighborVoxel = getSurfaceVoxelAt(voxelMap, pos.x + dir.dx, pos.z + dir.dz);
        if (neighborVoxel == null) continue;

        const neighborEntityType = getEntityTypeFromVoxel(neighborVoxel);
        const neighborTerrainType = getTerrainTypeFromVoxel(neighborVoxel);

        if (neighborEntityType === ENTITY_TYPES.pipe1 || isWaterTerrainType(neighborTerrainType)) {
            mask |= dir.bit;
        }
    }

    return mask;
}

/**
 * 指定タイルが畝間水路なら、接続マスクを再計算して voxel に書き戻す。
 * 畝間水路でない場合は何もしない。
 */
export function refreshPipeConnectionAt(voxelMap: IVoxelWriter, pos: Pos2D): void {
    if (!isInBounds(voxelMap, pos.x, pos.z)) return;

    const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
    const voxel = voxelMap.get(surfacePos);
    if (!isPipeVoxel(voxel)) return;

    const nextMask = computePipeConnectionMask(voxelMap, pos);
    const currentMask = getPipeConnectionsFromVoxel(voxel);
    if (currentMask === nextMask) return;

    voxelMap.set(setPipeConnectionsInVoxel(voxel, nextMask), surfacePos);
}

/** 指定タイルと上下左右4マスの畝間水路接続を局所再計算する。 */
export function refreshPipeConnectionsAround(voxelMap: IVoxelWriter, pos: Pos2D): void {
    refreshPipeConnectionAt(voxelMap, pos);

    for (const dir of CARDINAL_DIRS) {
        refreshPipeConnectionAt(voxelMap, { x: pos.x + dir.dx, z: pos.z + dir.dz });
    }
}
