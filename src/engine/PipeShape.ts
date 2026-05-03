import { getPipeConnectionsFromVoxel, getVariantFromVoxel } from "./TerrainDefs";

export type PipeShapeKey =
    | "h"
    | "v"
    | "end_u"
    | "end_d"
    | "end_l"
    | "end_r"
    | "corner_lu"
    | "corner_ld"
    | "corner_ru"
    | "corner_rd"
    | "t_u"
    | "t_d"
    | "t_l"
    | "t_r"
    | "cross";

export function getPipeShapeKey(voxel: bigint): PipeShapeKey {
    const mask = getPipeConnectionsFromVoxel(voxel);

    switch (mask) {
        case 0:
            return getVariantFromVoxel(voxel) === 0 ? "h" : "v";
        case 1:
            return "end_d";
        case 2:
            return "end_u";
        case 4:
            return "end_r";
        case 8:
            return "end_l";
        case 3:
            return "v";
        case 12:
            return "h";
        case 9:
            return "corner_ru";
        case 5:
            return "corner_lu";
        case 10:
            return "corner_rd";
        case 6:
            return "corner_ld";
        case 13:
            return "t_u";
        case 14:
            return "t_d";
        case 7:
            return "t_l";
        case 11:
            return "t_r";
        case 15:
            return "cross";
        default:
            return getVariantFromVoxel(voxel) === 0 ? "h" : "v";
    }
}

export function isIrrigatingPipeShape(shape: PipeShapeKey): boolean {
    return shape === "h" || shape === "v" || shape === "end_u" || shape === "end_d" || shape === "end_l" || shape === "end_r";
}

export function getPipeSpriteName(voxel: bigint, filled: boolean): string {
    const prefix = filled ? "pipe3_" : "pipe1_";
    return `${prefix}${getPipeShapeKey(voxel)}`;
}
