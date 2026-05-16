import { getPipeConnectionsFromVoxel, getVariantFromVoxel } from "./VoxelDefs";

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

export function getShaftShapeKey(voxel: bigint): ShaftShapeKey {
    const mask = getPipeConnectionsFromVoxel(voxel);

    switch (mask) {
        case 0:
            return getVariantFromVoxel(voxel) === 0 ? "132_h" : "132_v";
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
            return getVariantFromVoxel(voxel) === 0 ? "132_h" : "132_v";
    }
}

const ANIMATION_FRAMES = ["_1", "_2", "_3", "_4"];
const ANIM_FRAME_MS = 300;

export function getAnimationKey(): string {
    return ANIMATION_FRAMES[Math.floor(Date.now() / ANIM_FRAME_MS) % ANIMATION_FRAMES.length]
}

export function getShaftSpriteName(voxel: bigint): string {
    const prefix = "ss_sprite_";
    return `${prefix}${getShaftShapeKey(voxel)}${getAnimationKey()}.png`;
}
