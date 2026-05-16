import type { IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { findFacilityAnchor } from "../_registry/facilityUtil";
import {
    ENTITY_TYPES,
    getEntityTypeFromVoxel,
    getPipeConnectionsFromVoxel,
    setPipeFilledInVoxel,
} from "./VoxelDefs";

const SHAFT_CONNECTION_UP = 1 << 0;
const SHAFT_CONNECTION_DOWN = 1 << 1;
const SHAFT_CONNECTION_LEFT = 1 << 2;
const SHAFT_CONNECTION_RIGHT = 1 << 3;

const CARDINAL_DIRS: ReadonlyArray<{
    readonly dx: number;
    readonly dz: number;
    readonly bit: number;
    readonly oppositeBit: number;
}> = [
    { dx: 0, dz: -1, bit: SHAFT_CONNECTION_UP, oppositeBit: SHAFT_CONNECTION_DOWN },
    { dx: 0, dz: 1, bit: SHAFT_CONNECTION_DOWN, oppositeBit: SHAFT_CONNECTION_UP },
    { dx: -1, dz: 0, bit: SHAFT_CONNECTION_LEFT, oppositeBit: SHAFT_CONNECTION_RIGHT },
    { dx: 1, dz: 0, bit: SHAFT_CONNECTION_RIGHT, oppositeBit: SHAFT_CONNECTION_LEFT },
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

function isShaftAt(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    const voxel = getSurfaceVoxelAt(voxelMap, x, z);
    if (voxel == null) return false;
    return getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.shaft;
}

function isWaterwheelAdjacentToShaft(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    for (const dir of CARDINAL_DIRS) {
        const neighborVoxel = getSurfaceVoxelAt(voxelMap, x + dir.dx, z + dir.dz);
        if (neighborVoxel === null) continue;
        const entityType = getEntityTypeFromVoxel(neighborVoxel);
        if (entityType === ENTITY_TYPES.waterwheel) {
            return true;
        }
        if (entityType === ENTITY_TYPES.facility_part) {
            const anchor = findFacilityAnchor(voxelMap, x + dir.dx, z + dir.dz);
            if (anchor === null) continue;
            if (anchor.entityType === ENTITY_TYPES.waterwheel) {
                return true;
            }
        }
    }
    return false;
}

function canPowerFlowBetween(
    voxelMap: IVoxelWriter,
    x: number,
    z: number,
    dx: number,
    dz: number,
    bit: number,
    oppositeBit: number,
): boolean {
    const fromVoxel = getSurfaceVoxelAt(voxelMap, x, z);
    const toVoxel = getSurfaceVoxelAt(voxelMap, x + dx, z + dz);
    if (fromVoxel == null || toVoxel == null) return false;
    if (getEntityTypeFromVoxel(toVoxel) !== ENTITY_TYPES.shaft) return false;

    const fromMask = getPipeConnectionsFromVoxel(fromVoxel);
    const toMask = getPipeConnectionsFromVoxel(toVoxel);

    return (fromMask & bit) !== 0 && (toMask & oppositeBit) !== 0;
}

/**
 * マップ上の全シャフトについて、現在の動力伝達状態を再計算する。
 *
 * ルール:
 * - 水車エンティティ（waterwheel）に4近傍で隣接しているシャフトを動力源（起点）とする
 * - シャフト同士の接続マスク（getPipeConnectionsFromVoxel）を BFS でたどり、
 *   連結している全シャフトに距離制限なしで動力を伝播する
 * - 動力が伝達されたシャフトは pipe_filled ビット（setPipeFilledInVoxel）を true、
 *   それ以外は false に設定する（フラグビットは Pipe と共用）
 *
 * 接続マスク（pipe connections）は事前に最新化されている前提
 * （refreshShaftConnectionsAround などで更新済み）。
 */
export function recomputeAllShaftPowerFlow(voxelMap: IVoxelWriter): void {
    const allShafts: Pos2D[] = [];
    const queue: Array<{ x: number; z: number }> = [];
    const visited = new Set<number>();

    for (let z = 0; z < voxelMap.depth; z++) {
        for (let x = 0; x < voxelMap.width; x++) {
            if (!isShaftAt(voxelMap, x, z)) continue;

            allShafts.push({ x, z });

            if (!isWaterwheelAdjacentToShaft(voxelMap, x, z)) continue;

            const key = keyOf(voxelMap, x, z);
            if (visited.has(key)) continue;

            visited.add(key);
            queue.push({ x, z });
        }
    }

    let index = 0;
    while (index < queue.length) {
        const current = queue[index++];

        for (const dir of CARDINAL_DIRS) {
            const nx = current.x + dir.dx;
            const nz = current.z + dir.dz;
            if (!isInBounds(voxelMap, nx, nz)) continue;

            const key = keyOf(voxelMap, nx, nz);
            if (visited.has(key)) continue;
            if (!canPowerFlowBetween(voxelMap, current.x, current.z, dir.dx, dir.dz, dir.bit, dir.oppositeBit)) continue;

            visited.add(key);
            queue.push({ x: nx, z: nz });
        }
    }

    for (const pos of allShafts) {
        const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
        const voxel = voxelMap.get(surfacePos);
        const powered = visited.has(keyOf(voxelMap, pos.x, pos.z));
        voxelMap.set(setPipeFilledInVoxel(voxel, powered), surfacePos);
    }
}
