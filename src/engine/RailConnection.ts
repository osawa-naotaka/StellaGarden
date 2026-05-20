import type { IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import {
    ENTITY_TYPES,
    getEntityTypeFromVoxel,
    getConnectionsFromVoxel,
    getVariantFromVoxel,
    setConnectionsInVoxel,
    VOXEL_VARIANT,
} from "./VoxelDefs";

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
export function computeRailConnectionMask(voxelMap: IVoxelWriter, pos: Pos2D, currentMask: number): number {
    let mask = 0;

    const voxel = getSurfaceVoxelWithRailAt(voxelMap, pos.x, pos.z);
    if (voxel == null) return mask;

    const variant = getVariantFromVoxel(voxel) & 0x1;

    const left = getSurfaceVoxelWithRailAt(voxelMap, pos.x - 1, pos.z);
    const right = getSurfaceVoxelWithRailAt(voxelMap, pos.x + 1, pos.z);
    const top = getSurfaceVoxelWithRailAt(voxelMap, pos.x, pos.z - 1);
    const bottom = getSurfaceVoxelWithRailAt(voxelMap, pos.x, pos.z + 1);

    const leftVariant = left === null ? 0 : getVariantFromVoxel(left) & 0x1;
    const rightVariant = right === null ? 0 : getVariantFromVoxel(right) & 0x1;
    const topVariant = top === null ? 0 : getVariantFromVoxel(top) & 0x1;
    const bottomVariant = bottom === null ? 0 : getVariantFromVoxel(bottom) & 0x1;

    const nonNullCount = [left, right, top, bottom].filter((v) => v !== null).length;
    if (nonNullCount !== 2) {
        if (nonNullCount < 2) {
            if (variant === VOXEL_VARIANT.horizontal) {
                mask |= RAIL_CONNECTION_LEFT | RAIL_CONNECTION_RIGHT;
            } else {
                mask |= RAIL_CONNECTION_UP | RAIL_CONNECTION_DOWN;
            }
            return mask;
        }
        if (currentMask !== 0) {
            return currentMask;
        }
        if (variant === VOXEL_VARIANT.horizontal) {
            mask |= RAIL_CONNECTION_LEFT | RAIL_CONNECTION_RIGHT;
        } else {
            mask |= RAIL_CONNECTION_UP | RAIL_CONNECTION_DOWN;
        }
        return mask;
    }

    if (variant === VOXEL_VARIANT.horizontal) {
        if (left !== null) {
            mask |= RAIL_CONNECTION_LEFT;
        }
        if (right !== null) {
            mask |= RAIL_CONNECTION_RIGHT;
        }
        if (left === null && right === null) {
            mask |= RAIL_CONNECTION_LEFT | RAIL_CONNECTION_RIGHT;
        }
        if (top != null) {
            if (topVariant === VOXEL_VARIANT.vertical) {
                mask |= RAIL_CONNECTION_UP;
            }
        }
        if (bottom != null) {
            if (bottomVariant === VOXEL_VARIANT.vertical) {
                mask |= RAIL_CONNECTION_DOWN;
            }
        }
    } else if (variant === VOXEL_VARIANT.vertical) {
        if (top !== null) {
            mask |= RAIL_CONNECTION_UP;
        }
        if (bottom !== null) {
            mask |= RAIL_CONNECTION_DOWN;
        }
        if (top === null && bottom === null) {
            mask |= RAIL_CONNECTION_UP | RAIL_CONNECTION_DOWN;
        }

        if (left != null) {
            if (leftVariant === VOXEL_VARIANT.horizontal) {
                mask |= RAIL_CONNECTION_LEFT;
            }
        }
        if (right != null) {
            if (rightVariant === VOXEL_VARIANT.horizontal) {
                mask |= RAIL_CONNECTION_RIGHT;
            }
        }
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
    const nextMask = computeRailConnectionMask(voxelMap, pos, currentMask);
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
