import type { IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { ENTITY_TYPES, getConnectionsFromVoxel, getEntityTypeFromVoxel, getVariantFromVoxel, setConnectionsInVoxel, VOXEL_VARIANT } from "./VoxelDefs";

export const RAIL_CONNECTION_UP = 1 << 0;
export const RAIL_CONNECTION_DOWN = 1 << 1;
export const RAIL_CONNECTION_LEFT = 1 << 2;
export const RAIL_CONNECTION_RIGHT = 1 << 3;

const CARDINAL_DIRS: ReadonlyArray<{
    readonly dx: number;
    readonly dz: number;
    readonly bit: number;
}> = [
    { dx: 0, dz: -1, bit: RAIL_CONNECTION_UP },
    { dx: 0, dz: 1, bit: RAIL_CONNECTION_DOWN },
    { dx: -1, dz: 0, bit: RAIL_CONNECTION_LEFT },
    { dx: 1, dz: 0, bit: RAIL_CONNECTION_RIGHT },
];

/** 指定 voxel がレールエンティティかどうか。 */
export function isRailVoxel(voxel: bigint): boolean {
    return getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.rail;
}

/** 指定座標がマップ範囲内かどうか。 */
function isInBounds(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    return x >= 0 && x < voxelMap.width && z >= 0 && z < voxelMap.depth;
}

/** 指定座標の surface voxel を取得する。範囲外なら null。 */
function getSurfaceVoxelWithRailAt(voxelMap: IVoxelWriter, x: number, z: number): bigint | null {
    if (!isInBounds(voxelMap, x, z)) return null;
    const surfacePos = voxelMap.getSurfacePosition({ x, y: 0, z });
    const voxel = voxelMap.get(surfacePos);
    if (!isRailVoxel(voxel)) return null;
    return voxel;
}

/**
 * 指定タイルの4近傍から、レールの接続マスクを計算する。
 *
 */
export function computeRailConnectionMask(voxelMap: IVoxelWriter, pos: Pos2D): number {
    const voxel = getSurfaceVoxelWithRailAt(voxelMap, pos.x, pos.z);
    if (voxel == null) return 0;

    const variant = getVariantFromVoxel(voxel);

    const left = getSurfaceVoxelWithRailAt(voxelMap, pos.x - 1, pos.z);
    const right = getSurfaceVoxelWithRailAt(voxelMap, pos.x + 1, pos.z);
    const top = getSurfaceVoxelWithRailAt(voxelMap, pos.x, pos.z - 1);
    const bottom = getSurfaceVoxelWithRailAt(voxelMap, pos.x, pos.z + 1);

    const leftMask = left === null ? 0 : getConnectionsFromVoxel(left);
    const rightMask = right === null ? 0 : getConnectionsFromVoxel(right);
    const topMask = top === null ? 0 : getConnectionsFromVoxel(top);
    const bottomMask = bottom === null ? 0 : getConnectionsFromVoxel(bottom);

    const connectToLeft = (leftMask & RAIL_CONNECTION_RIGHT) !== 0;
    const connectToRight = (rightMask & RAIL_CONNECTION_LEFT) !== 0;
    const connectToTop = (topMask & RAIL_CONNECTION_DOWN) !== 0;
    const connectToBottom = (bottomMask & RAIL_CONNECTION_UP) !== 0;

    const connectCount = [connectToLeft, connectToRight, connectToTop, connectToBottom].filter((v) => v).length;

    if (connectCount !== 2) {
        if (variant === VOXEL_VARIANT.horizontal) {
            return RAIL_CONNECTION_LEFT | RAIL_CONNECTION_RIGHT;
        } else {
            return RAIL_CONNECTION_UP | RAIL_CONNECTION_DOWN;
        }
    }

    // connect count 2
    let mask = 0;
    if (connectToLeft) {
        mask |= RAIL_CONNECTION_LEFT;
    }
    if (connectToRight) {
        mask |= RAIL_CONNECTION_RIGHT;
    }
    if (connectToTop) {
        mask |= RAIL_CONNECTION_UP;
    }
    if (connectToBottom) {
        mask |= RAIL_CONNECTION_DOWN;
    }
    return mask;
}

/**
 * 指定タイルがシャフトなら、接続マスクを再計算して voxel に書き戻す。
 * シャフトでない場合は何もしない。
 */
export function refreshRailConnectionAt(voxelMap: IVoxelWriter, pos: Pos2D): void {
    if (!isInBounds(voxelMap, pos.x, pos.z)) return;

    const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
    const voxel = voxelMap.get(surfacePos);
    if (!isRailVoxel(voxel)) return;

    const currentMask = getConnectionsFromVoxel(voxel);
    const nextMask = computeRailConnectionMask(voxelMap, pos);
    if (currentMask === nextMask) return;

    voxelMap.set(setConnectionsInVoxel(voxel, nextMask), surfacePos);
}

/** 指定タイルと上下左右4マスのシャフト接続を局所再計算する。 */
export function refreshRailConnectionsAround(voxelMap: IVoxelWriter, pos: Pos2D): void {
    refreshRailConnectionAt(voxelMap, pos);

    for (const dir of CARDINAL_DIRS) {
        refreshRailConnectionAt(voxelMap, { x: pos.x + dir.dx, z: pos.z + dir.dz });
    }
}
