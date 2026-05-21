import type { IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getConnectionsFromVoxel, getTerrainTypeFromVoxel, setEnabledInVoxel, TERRAIN_TYPES } from "./VoxelDefs";

export const PIPE_WATER_MAX_DISTANCE = 16;

const PIPE_CONNECTION_UP = 1 << 0;
const PIPE_CONNECTION_DOWN = 1 << 1;
const PIPE_CONNECTION_LEFT = 1 << 2;
const PIPE_CONNECTION_RIGHT = 1 << 3;

const CARDINAL_DIRS: ReadonlyArray<{
    readonly dx: number;
    readonly dz: number;
    readonly bit: number;
    readonly oppositeBit: number;
}> = [
    { dx: 0, dz: -1, bit: PIPE_CONNECTION_UP, oppositeBit: PIPE_CONNECTION_DOWN },
    { dx: 0, dz: 1, bit: PIPE_CONNECTION_DOWN, oppositeBit: PIPE_CONNECTION_UP },
    { dx: -1, dz: 0, bit: PIPE_CONNECTION_LEFT, oppositeBit: PIPE_CONNECTION_RIGHT },
    { dx: 1, dz: 0, bit: PIPE_CONNECTION_RIGHT, oppositeBit: PIPE_CONNECTION_LEFT },
];

function isInBounds(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    return x >= 0 && x < voxelMap.width && z >= 0 && z < voxelMap.depth;
}

function keyOf(voxelMap: IVoxelWriter, x: number, z: number): number {
    return z * voxelMap.width + x;
}

function getSurfaceVoxelAt(voxelMap: IVoxelWriter, x: number, z: number): bigint | null {
    if (!isInBounds(voxelMap, x, z)) return null;
    const surfacePos = voxelMap.getSurfacePosition({ x, y: 0, z });
    return voxelMap.get(surfacePos);
}

function isPipeAt(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    const voxel = getSurfaceVoxelAt(voxelMap, x, z);
    if (voxel == null) return false;
    return getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.furrow_canal;
}

function isWaterAdjacentToPipe(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    for (const dir of CARDINAL_DIRS) {
        const neighborVoxel = getSurfaceVoxelAt(voxelMap, x + dir.dx, z + dir.dz);
        if (neighborVoxel == null) continue;

        const terrainType = getTerrainTypeFromVoxel(neighborVoxel);
        if (terrainType === TERRAIN_TYPES.water || terrainType === TERRAIN_TYPES.waterSource) {
            return true;
        }
    }
    return false;
}

function canFlowBetween(voxelMap: IVoxelWriter, x: number, z: number, dx: number, dz: number, bit: number, oppositeBit: number): boolean {
    const fromVoxel = getSurfaceVoxelAt(voxelMap, x, z);
    const toVoxel = getSurfaceVoxelAt(voxelMap, x + dx, z + dz);
    if (fromVoxel == null || toVoxel == null) return false;
    if (getEntityTypeFromVoxel(toVoxel) !== ENTITY_TYPES.furrow_canal) return false;

    const fromMask = getConnectionsFromVoxel(fromVoxel);
    const toMask = getConnectionsFromVoxel(toVoxel);

    return (fromMask & bit) !== 0 && (toMask & oppositeBit) !== 0;
}

/**
 * マップ上の全畝間水路について、現在の通水状態を再計算する。
 *
 * ルール:
 * - 水タイル（water / waterSource）に隣接する畝間水路を距離 0 の起点とする
 * - 畝間水路同士を BFS でたどり、距離 m (=16) まで水が伝播する
 * - 到達した畝間水路は filled=true、それ以外は filled=false
 *
 * 接続形状（pipe connections）は事前に最新化されている前提。
 */
export function recomputeAllPipeWaterFlow(voxelMap: IVoxelWriter, maxDistance: number = PIPE_WATER_MAX_DISTANCE): void {
    const allPipes: Pos2D[] = [];
    const queue: Array<{ x: number; z: number; dist: number }> = [];
    const visited = new Set<number>();

    for (let z = 0; z < voxelMap.depth; z++) {
        for (let x = 0; x < voxelMap.width; x++) {
            if (!isPipeAt(voxelMap, x, z)) continue;

            allPipes.push({ x, z });

            if (!isWaterAdjacentToPipe(voxelMap, x, z)) continue;

            const key = keyOf(voxelMap, x, z);
            if (visited.has(key)) continue;

            visited.add(key);
            queue.push({ x, z, dist: 0 });
        }
    }

    let index = 0;
    while (index < queue.length) {
        const current = queue[index++];
        if (current.dist >= maxDistance) continue;

        for (const dir of CARDINAL_DIRS) {
            const nx = current.x + dir.dx;
            const nz = current.z + dir.dz;
            if (!isInBounds(voxelMap, nx, nz)) continue;

            const key = keyOf(voxelMap, nx, nz);
            if (visited.has(key)) continue;
            if (!canFlowBetween(voxelMap, current.x, current.z, dir.dx, dir.dz, dir.bit, dir.oppositeBit)) continue;

            visited.add(key);
            queue.push({ x: nx, z: nz, dist: current.dist + 1 });
        }
    }

    for (const pos of allPipes) {
        const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surfacePos);
        const filled = visited.has(keyOf(voxelMap, pos.x, pos.z));
        voxelMap.set(setEnabledInVoxel(voxel, filled), surfacePos);
    }
}
