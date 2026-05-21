import type { IVoxelWriter, Pos3D } from "../_boundary/interfaces";
import { findFacilityAnchor } from "../_registry/facilityUtil";
import { ENTITY_TYPES, getConnectionsFromVoxel, getEntityTypeFromVoxel, setDirectionInVoxel, setEnabledInVoxel, VOXEL_DIRECTION } from "./VoxelDefs";

const RAIL_CONNECTION_UP = 1 << 0;
const RAIL_CONNECTION_DOWN = 1 << 1;
const RAIL_CONNECTION_LEFT = 1 << 2;
const RAIL_CONNECTION_RIGHT = 1 << 3;

const CARDINAL_DIRS: ReadonlyArray<{
    readonly dx: number;
    readonly dz: number;
    readonly bit: number;
    readonly oppositeBit: number;
}> = [
    { dx: 0, dz: -1, bit: RAIL_CONNECTION_UP, oppositeBit: RAIL_CONNECTION_DOWN },
    { dx: 0, dz: 1, bit: RAIL_CONNECTION_DOWN, oppositeBit: RAIL_CONNECTION_UP },
    { dx: -1, dz: 0, bit: RAIL_CONNECTION_LEFT, oppositeBit: RAIL_CONNECTION_RIGHT },
    { dx: 1, dz: 0, bit: RAIL_CONNECTION_RIGHT, oppositeBit: RAIL_CONNECTION_LEFT },
];

function isInBounds(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    return x >= 0 && x < voxelMap.width && z >= 0 && z < voxelMap.depth;
}

function keyOf(voxelMap: IVoxelWriter, x: number, z: number): number {
    return z * voxelMap.width + x;
}

/**
 * マップ上の全レールについて、現在の動力伝達状態を再計算する。
 *
 * 接続マスク（pipe connections）は事前に最新化されている前提
 * （refreshRailConnectionsAround などで更新済み）。
 */

export function recomputeAllRailTractionFlow(voxelMap: IVoxelWriter): void {
    const visited = new Set<number>();

    // まず牽引力のソースとなるウインチと、牽引力を伝播するレールを全て見つける
    const allWinches: Pos3D[] = [];
    const allRails: Pos3D[] = [];
    for (let z = 0; z < voxelMap.depth; z++) {
        for (let x = 0; x < voxelMap.width; x++) {
            const pos = voxelMap.getSurfacePosition({ x, y: 0, z });
            const voxel = voxelMap.get(pos);
            const entityType = getEntityTypeFromVoxel(voxel);
            if (entityType === ENTITY_TYPES.winch) {
                allWinches.push(pos);
                visited.add(keyOf(voxelMap, x, z));
            } else if (entityType === ENTITY_TYPES.rail) {
                allRails.push(pos);
            } else if (entityType === ENTITY_TYPES.facility_part) {
                const anchor = findFacilityAnchor(voxelMap, x, z);
                if (anchor.entityType === ENTITY_TYPES.winch) {
                    allWinches.push(pos);
                    visited.add(keyOf(voxelMap, x, z));
                }
            }
        }
    }

    // 全てのレールをいったんdisable化 & 牽引方向を初期化
    for (const railPos of allRails) {
        let voxel = voxelMap.get(railPos);
        voxel = setDirectionInVoxel(voxel, VOXEL_DIRECTION.forward);
        voxel = setEnabledInVoxel(voxel, false);
        voxelMap.set(voxel, railPos);
    }

    // ウインチから伸びる牽引力を計算
    for (const winch of allWinches) {
        // ウインチに隣接したレールを見つける
        const distFromWinch = findTractionDistinations(voxelMap, winch.x, winch.z);

        // ウインチに隣接したレールに牽引力を設定
        for (const d of distFromWinch) {
            setTractionDirectionAndEnable(voxelMap, d.pos.x, d.pos.z, d.dir);
        }

        // 牽引力を伝播させていく
        const queue: TractionDistination[] = distFromWinch;

        while (queue.length > 0) {
            const current = queue.shift()!;
            const currentKey = keyOf(voxelMap, current.pos.x, current.pos.z);
            if (visited.has(currentKey)) continue;
            visited.add(currentKey);

            const dist = findTractionDistinations(voxelMap, current.pos.x, current.pos.z);
            for (const d of dist) {
                if (visited.has(keyOf(voxelMap, d.pos.x, d.pos.z))) continue;
                setTractionDirectionAndEnable(voxelMap, d.pos.x, d.pos.z, d.dir);
                queue.push(d);
            }
        }
    }
}

type TractionDistination = {
    pos: Pos3D;
    voxel: bigint;
    dir: number;
};

function findTractionDistinations(voxelMap: IVoxelWriter, x: number, z: number): TractionDistination[] {
    const dist: TractionDistination[] = [];
    for (const dir of CARDINAL_DIRS) {
        const nx = x + dir.dx;
        const nz = z + dir.dz;
        if (!isInBounds(voxelMap, nx, nz)) continue;

        const pos = voxelMap.getSurfacePosition({ x: nx, y: 0, z: nz });
        const voxel = voxelMap.get(pos);
        const entityType = getEntityTypeFromVoxel(voxel);
        if (entityType === ENTITY_TYPES.rail) {
            const mask = getConnectionsFromVoxel(voxel);
            if (!(mask & dir.oppositeBit)) continue;
            dist.push({ pos, voxel, dir: dir.oppositeBit });
        }
    }

    return dist;
}

function setTractionDirectionAndEnable(voxelMap: IVoxelWriter, x: number, z: number, dir: number): void {
    const pos = voxelMap.getSurfacePosition({ x, y: 0, z });
    const voxel = voxelMap.get(pos);
    const mask = getConnectionsFromVoxel(voxel);

    let voxelDirection = 0;
    switch (mask) {
        case RAIL_CONNECTION_UP:
        case RAIL_CONNECTION_DOWN:
        case RAIL_CONNECTION_UP | RAIL_CONNECTION_DOWN:
            if (dir !== RAIL_CONNECTION_UP && dir !== RAIL_CONNECTION_DOWN) return;

            voxelDirection = dir === RAIL_CONNECTION_DOWN ? VOXEL_DIRECTION.forward : VOXEL_DIRECTION.backward;
            break;

        case RAIL_CONNECTION_RIGHT:
        case RAIL_CONNECTION_LEFT:
        case RAIL_CONNECTION_RIGHT | RAIL_CONNECTION_LEFT:
            if (dir !== RAIL_CONNECTION_RIGHT && dir !== RAIL_CONNECTION_LEFT) return;

            voxelDirection = dir === RAIL_CONNECTION_RIGHT ? VOXEL_DIRECTION.forward : VOXEL_DIRECTION.backward;
            break;

        case RAIL_CONNECTION_UP | RAIL_CONNECTION_RIGHT:
            if (dir !== RAIL_CONNECTION_UP && dir !== RAIL_CONNECTION_RIGHT) return;

            voxelDirection = dir === RAIL_CONNECTION_UP ? VOXEL_DIRECTION.forward : VOXEL_DIRECTION.backward;
            break;

        case RAIL_CONNECTION_UP | RAIL_CONNECTION_LEFT:
            if (dir !== RAIL_CONNECTION_UP && dir !== RAIL_CONNECTION_LEFT) return;

            voxelDirection = dir === RAIL_CONNECTION_LEFT ? VOXEL_DIRECTION.forward : VOXEL_DIRECTION.backward;
            break;

        case RAIL_CONNECTION_DOWN | RAIL_CONNECTION_RIGHT:
            if (dir !== RAIL_CONNECTION_DOWN && dir !== RAIL_CONNECTION_RIGHT) return;

            voxelDirection = dir === RAIL_CONNECTION_RIGHT ? VOXEL_DIRECTION.forward : VOXEL_DIRECTION.backward;
            break;

        case RAIL_CONNECTION_DOWN | RAIL_CONNECTION_LEFT:
            if (dir !== RAIL_CONNECTION_DOWN && dir !== RAIL_CONNECTION_LEFT) return;

            voxelDirection = dir === RAIL_CONNECTION_DOWN ? VOXEL_DIRECTION.forward : VOXEL_DIRECTION.backward;
            break;
    }

    voxelMap.set(setDirectionInVoxel(setEnabledInVoxel(voxel, true), voxelDirection), pos);
}
