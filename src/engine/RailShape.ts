import { RAIL_CONNECTION_DOWN, RAIL_CONNECTION_LEFT, RAIL_CONNECTION_RIGHT, RAIL_CONNECTION_UP } from "./RailConnection";
import { getConnectionsFromVoxel, getVariantFromVoxel, VOXEL_VARIANT } from "./VoxelDefs";

export type RailShapeKey = "rail_h" | "rail_v" | "rail_l_ru" | "rail_l_rd" | "rail_l_lu" | "rail_l_ld";

/**
 * レールの方向（horizontal=0 / vertical=1）を取り出す。
 * variantのbit 0 のみ参照
 */
export function getRailOrientation(voxel: bigint): number {
    const variant = getVariantFromVoxel(voxel);
    switch (variant) {
        case VOXEL_VARIANT.horizontal:
        case VOXEL_VARIANT.vertical:
            return variant;
        default:
            throw new Error(`Invalid rail variant: ${variant}`);
    }
}

/**
 * 指定された接続マスクが直線シャフトかどうかを返す。
 * 接続なし(0)、縦直線(3=UP+DOWN)、横直線(12=LEFT+RIGHT) を直線扱い。
 * これ以外はL字・T字・十字でベベルギアを介する。
 */
export function isRailStraightMask(mask: number): boolean {
    // return mask === 0 || mask === 3 || mask === 12;
    return mask === 0 || mask === 1 || mask === 2 || mask === 3 || mask === 4 || mask === 8 || mask === 12;
}

export function getRailShapeKey(voxel: bigint): RailShapeKey {
    const mask = getConnectionsFromVoxel(voxel);

    switch (mask) {
        case 0:
            return getRailOrientation(voxel) === VOXEL_VARIANT.horizontal ? "rail_h" : "rail_v";
        case RAIL_CONNECTION_LEFT:
        case RAIL_CONNECTION_RIGHT:
        case RAIL_CONNECTION_LEFT | RAIL_CONNECTION_RIGHT:
            return "rail_h";
        case RAIL_CONNECTION_UP:
        case RAIL_CONNECTION_DOWN:
        case RAIL_CONNECTION_UP | RAIL_CONNECTION_DOWN:
            return "rail_v";
        case RAIL_CONNECTION_UP | RAIL_CONNECTION_RIGHT:
            return "rail_l_ru";
        case RAIL_CONNECTION_DOWN | RAIL_CONNECTION_RIGHT:
            return "rail_l_rd";
        case RAIL_CONNECTION_UP | RAIL_CONNECTION_LEFT:
            return "rail_l_lu";
        case RAIL_CONNECTION_DOWN | RAIL_CONNECTION_LEFT:
            return "rail_l_ld";
        default:
            throw new Error(`Unknown mask: ${mask}`);
    }
}

export function getRailSpriteName(voxel: bigint): string {
    return getRailShapeKey(voxel);
}
