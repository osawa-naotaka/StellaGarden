import { getConnectionsFromVoxel, getEnabledFromVoxel, getDirectionFromVoxel, getVariantFromVoxel, VOXEL_DIRECTION } from "./VoxelDefs";

export type ShaftShapeKey =
    | "132_h"
    | "132_v"
    | "133_corner_lu"
    | "133_corner_ld"
    | "133_corner_ru"
    | "133_corner_rd"
    | "134_t_u"
    | "134_t_d"
    | "134_t_l"
    | "134_t_r"
    | "135";

/**
 * シャフトの方向（horizontal=0 / vertical=1）を取り出す。
 * variantのbit 0 のみ参照（bit 1 は逆回転フラグ）。
 */
export function getShaftOrientation(voxel: bigint): number {
    return getVariantFromVoxel(voxel);
}

/**
 * シャフトが逆回転状態かどうか。variantのbit 1 を参照。
 */
export function isShaftReversed(voxel: bigint): boolean {
    return getDirectionFromVoxel(voxel) === VOXEL_DIRECTION.backward;
}

/**
 * 指定された接続マスクが直線シャフトかどうかを返す。
 * 接続なし(0)、縦直線(3=UP+DOWN)、横直線(12=LEFT+RIGHT) を直線扱い。
 * これ以外はL字・T字・十字でベベルギアを介する。
 */
export function isShaftStraightMask(mask: number): boolean {
  // return mask === 0 || mask === 3 || mask === 12;
  return mask === 0 || mask === 1 || mask === 2 || mask === 3 || mask === 4 || mask == 8 || mask === 12;
}

export function getShaftShapeKey(voxel: bigint): ShaftShapeKey {
    const mask = getConnectionsFromVoxel(voxel);

    switch (mask) {
        case 0:
            return getShaftOrientation(voxel) === 0 ? "132_h" : "132_v";
        case 3:
            return "132_v";
        case 12:
            return "132_h";
        case 9:
            return "133_corner_ru";
        case 5:
            return "133_corner_lu";
        case 10:
            return "133_corner_rd";
        case 6:
            return "133_corner_ld";
        case 13:
            return "134_t_u";
        case 14:
            return "134_t_d";
        case 7:
            return "134_t_l";
        case 11:
            return "134_t_r";
        case 15:
            return "135";
        default:
            return getShaftOrientation(voxel) === 0 ? "132_h" : "132_v";
    }
}

const ANIM_FRAMES_FORWARD = ["_1", "_2", "_3", "_4"];
const ANIM_FRAMES_REVERSED = ["_4", "_3", "_2", "_1"];
const ANIM_FRAME_MS = 300;

export function getShaftSpriteName(voxel: bigint): string {
    const prefix = "ss_sprite_";
    const powered = getEnabledFromVoxel(voxel);
    const reversed = isShaftReversed(voxel);
    const frames = reversed ? ANIM_FRAMES_REVERSED : ANIM_FRAMES_FORWARD;
    const akey = powered ? frames[Math.floor(Date.now() / ANIM_FRAME_MS) % frames.length] : frames[0];
    return `${prefix}${getShaftShapeKey(voxel)}${akey}.png`;
}
