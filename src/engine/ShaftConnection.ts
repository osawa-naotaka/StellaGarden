import type { IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import {
    ENTITY_TYPES,
    getEntityTypeFromVoxel,
    getConnectionsFromVoxel,
    getVariantFromVoxel,
    setConnectionsInVoxel,
    VOXEL_VARIANT,
} from "./VoxelDefs";

export const SHAFT_CONNECTION_UP = 1 << 0;
export const SHAFT_CONNECTION_DOWN = 1 << 1;
export const SHAFT_CONNECTION_LEFT = 1 << 2;
export const SHAFT_CONNECTION_RIGHT = 1 << 3;

const CARDINAL_DIRS: ReadonlyArray<{
    readonly dx: number;
    readonly dz: number;
    readonly bit: number;
}> = [
    { dx: 0, dz: -1, bit: SHAFT_CONNECTION_UP },
    { dx: 0, dz: 1, bit: SHAFT_CONNECTION_DOWN },
    { dx: -1, dz: 0, bit: SHAFT_CONNECTION_LEFT },
    { dx: 1, dz: 0, bit: SHAFT_CONNECTION_RIGHT },
];

/** 指定 voxel が畝間水路エンティティかどうか。 */
export function isShaftVoxel(voxel: bigint): boolean {
    return getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.shaft;
}

/** 指定座標がマップ範囲内かどうか。 */
function isInBounds(voxelMap: IVoxelWriter, x: number, z: number): boolean {
    return x >= 0 && x < voxelMap.width && z >= 0 && z < voxelMap.depth;
}

/** 指定座標の surface voxel を取得する。範囲外なら null。 */
function getSurfaceVoxelWithShaftAt(voxelMap: IVoxelWriter, x: number, z: number): bigint | null {
    if (!isInBounds(voxelMap, x, z)) return null;
    const surfacePos = voxelMap.getSurfacePosition({ x, y: 0, z });
    const voxel = voxelMap.get(surfacePos);
    if (!isShaftVoxel(voxel)) return null;
    return voxel;
}

/**
 * 指定タイルの4近傍から、シャフトの接続マスクを計算する。
 *
 */
export function computeShaftConnectionMask(voxelMap: IVoxelWriter, pos: Pos2D): number {
    let mask = 0;

    const voxel = getSurfaceVoxelWithShaftAt(voxelMap, pos.x, pos.z);
    if (voxel == null) return mask;

    const variant = getVariantFromVoxel(voxel) & 0x1;

    const left = getSurfaceVoxelWithShaftAt(voxelMap, pos.x - 1, pos.z);
    const right = getSurfaceVoxelWithShaftAt(voxelMap, pos.x + 1, pos.z);
    const top = getSurfaceVoxelWithShaftAt(voxelMap, pos.x, pos.z - 1);
    const bottom = getSurfaceVoxelWithShaftAt(voxelMap, pos.x, pos.z + 1);

    const leftVariant = left === null ? 0 : getVariantFromVoxel(left);
    const rightVariant = right === null ? 0 : getVariantFromVoxel(right);
    const topVariant = top === null ? 0 : getVariantFromVoxel(top);
    const bottomVariant = bottom === null ? 0 : getVariantFromVoxel(bottom);

    if (variant === VOXEL_VARIANT.horizontal) {
        if (left !== null) {
            mask |= SHAFT_CONNECTION_LEFT;
        }
        if (right !== null) {
            mask |= SHAFT_CONNECTION_RIGHT;
        }
        if (left === null && right === null) {
            mask |= SHAFT_CONNECTION_LEFT | SHAFT_CONNECTION_RIGHT;
        }
        if (top != null) {
            if (topVariant === VOXEL_VARIANT.vertical) {
                mask |= SHAFT_CONNECTION_UP;
            }
        }
        if (bottom != null) {
            if (bottomVariant === VOXEL_VARIANT.vertical) {
                mask |= SHAFT_CONNECTION_DOWN;
            }
        }
    } else if (variant === VOXEL_VARIANT.vertical) {
        if (top !== null) {
            mask |= SHAFT_CONNECTION_UP;
        }
        if (bottom !== null) {
            mask |= SHAFT_CONNECTION_DOWN;
        }
        if (top === null && bottom === null) {
            mask |= SHAFT_CONNECTION_UP | SHAFT_CONNECTION_DOWN;
        }

        if (left != null) {
            if (leftVariant === VOXEL_VARIANT.horizontal) {
                mask |= SHAFT_CONNECTION_LEFT;
            }
        }
        if (right != null) {
            if (rightVariant === VOXEL_VARIANT.horizontal) {
                mask |= SHAFT_CONNECTION_RIGHT;
            }
        }
    }

    return mask;
}

/**
 * 指定タイルがシャフトなら、接続マスクを再計算して voxel に書き戻す。
 * シャフトでない場合は何もしない。
 */
export function refreshShaftConnectionAt(voxelMap: IVoxelWriter, pos: Pos2D): void {
    if (!isInBounds(voxelMap, pos.x, pos.z)) return;

    const surfacePos = voxelMap.getSurfacePosition({ x: pos.x, y: 0, z: pos.z });
    const voxel = voxelMap.get(surfacePos);
    if (!isShaftVoxel(voxel)) return;

    const nextMask = computeShaftConnectionMask(voxelMap, pos);
    const currentMask = getConnectionsFromVoxel(voxel);
    if (currentMask === nextMask) return;

    voxelMap.set(setConnectionsInVoxel(voxel, nextMask), surfacePos);
}

/** 指定タイルと上下左右4マスのシャフト接続を局所再計算する。 */
export function refreshShaftConnectionsAround(voxelMap: IVoxelWriter, pos: Pos2D): void {
    refreshShaftConnectionAt(voxelMap, pos);

    for (const dir of CARDINAL_DIRS) {
        refreshShaftConnectionAt(voxelMap, { x: pos.x + dir.dx, z: pos.z + dir.dz });
    }
}
