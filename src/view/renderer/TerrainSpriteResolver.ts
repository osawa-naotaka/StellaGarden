import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../../engine/TerrainDefs";
import type { Pos3D } from "../../lib/VoxelMap";

// -----------------------------------------------------------------------------
// 内部ヘルパー: 高さ配列 ↔ ID の変換
// -----------------------------------------------------------------------------

/** 上下左右中の5点（インデックス 1,3,4,5,7）の高さから ID を計算する。 */
function calcId5FromHights(hights: number[]): number {
    const idArr = [0, hights[1], 0, hights[3], hights[4], hights[5], 0, hights[7], 0];
    return idArr.reduce((prev, cur) => (prev << 2) | cur, 0);
}

/** Pos3D 配列の上下左右中の5点から ID を計算する。 */
function calcId5FromPos3D(pos: Pos3D[]): number {
    const idArr = [0, pos[1].y, 0, pos[3].y, pos[4].y, pos[5].y, 0, pos[7].y, 0];
    return idArr.reduce((prev, cur) => (prev << 2) | cur, 0);
}

function calcId5FromVoxel(voxelIsSoil: number[]): number {
    const idArr = [0, voxelIsSoil[1], 0, voxelIsSoil[3], voxelIsSoil[4], voxelIsSoil[5], 0, voxelIsSoil[7], 0];
    return idArr.reduce((prev, cur) => (prev << 2) | cur, 0);
}

/** 5点 ID から高さ配列を復元する（デバッグ用）。 */
function calcHightsFromId(id5: number): number[] {
    const hights: number[] = [];
    for (let i = 0; i < 9; i++) {
        hights.unshift(id5 & 0x00000003);
        id5 >>= 2;
    }
    return hights;
}

/** 9点すべての高さから ID を計算する。 */
function calcId9FromHights(hights: number[]): number {
    return hights.reduce((prev, cur) => (prev << 2) | cur, 0);
}

/** Pos3D 配列の9点すべての高さから ID を計算する。 */
function calcId9FromPos3D(pos: Pos3D[]): number {
    return pos.reduce((prev, cur) => (prev << 2) | cur.y, 0);
}

function calcId9FromVoxel(voxelIsSoil: number[]): number {
    return voxelIsSoil.reduce((prev, cur) => (prev << 2) | cur, 0);
}

export function soilSpriteName(pos: Pos3D[], centerHight: number, voxel: number[]): string[] {
    const baseSprites = grassSpritesName(pos, centerHight);

    const voxelIsSoil = voxel.map((v) => (getTerrainTypeFromVoxel(v) === TERRAIN_TYPES.soil || getTerrainTypeFromVoxel(v) === TERRAIN_TYPES.wetSoil ? 1 : 0));

    const soilId5 = calcId5FromVoxel(voxelIsSoil);
    const soilId9 = calcId9FromVoxel(voxelIsSoil);

    switch (soilId9) {
        case calcId9FromHights([0, 0, 0, 0, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_3_0"];
        case calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_3_1"];
        case calcId9FromHights([0, 0, 0, 1, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_3_2"];
        case calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_3_3"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_3_4"];
        case calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_3_5"];
        case calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_3_6"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_3_7"];
        case calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_3_8"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_4_0"];
        case calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_normal_0_4_1"];
        case calcId9FromHights([0, 0, 0, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_normal_0_4_2"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_4_3"];
        case calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_normal_0_4_4"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_normal_0_4_5"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_normal_0_4_6"];
        case calcId9FromHights([0, 1, 0, 1, 1, 0, 1, 1, 0]):
            return [...baseSprites, "soil_normal_0_4_7"];
        case calcId9FromHights([0, 1, 1, 0, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_4_8"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_normal_0_4_9"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_normal_0_4_10"];
        case calcId9FromHights([1, 1, 0, 1, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_4_11"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_normal_0_4_12"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_4_13"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_4_14"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_normal_0_4_15"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_normal_0_5_1"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_normal_0_5_5"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_normal_0_5_7"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_normal_0_5_9"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_normal_0_5_10"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_5_14"];

        default:
            break;
    }

    switch (soilId5) {
        case calcId5FromHights([0, 0, 0, 0, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_0_0"];
        case calcId5FromHights([0, 1, 0, 0, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_1_0"];
        case calcId5FromHights([0, 1, 0, 0, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_1_1"];
        case calcId5FromHights([0, 0, 0, 0, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_normal_0_1_2"];
        case calcId5FromHights([0, 0, 0, 0, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_2_0"];
        case calcId5FromHights([0, 0, 0, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_2_1"];
        case calcId5FromHights([0, 0, 0, 1, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_2_2"];

        case calcId5FromHights([0, 0, 0, 0, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_normal_0_5_0"];
        case calcId5FromHights([0, 0, 0, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_normal_0_5_2"];
        case calcId5FromHights([0, 0, 0, 1, 1, 0, 1, 1, 0]):
            return [...baseSprites, "soil_normal_0_5_3"];
        case calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_normal_0_5_4"];
        case calcId5FromHights([1, 1, 1, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_normal_0_5_9"];
        case calcId5FromHights([1, 1, 0, 1, 1, 0, 1, 1, 0]):
            return [...baseSprites, "soil_normal_0_5_11"];
        case calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_5_12"];
        case calcId5FromHights([1, 1, 1, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_5_13"];
        case calcId5FromHights([1, 1, 0, 1, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_normal_0_5_15"];

        default:
            return [...baseSprites, "soil_normal_0_5_9"];
    }
}

function wetSoilSpriteName(pos: Pos3D[], centerHight: number, voxel: number[]): string[] {
    const baseSprites = soilSpriteName(pos, centerHight, voxel);
    const voxelIsWetSoil = voxel.map((v) => (getTerrainTypeFromVoxel(v) === TERRAIN_TYPES.wetSoil ? 1 : 0));

    const soilId5 = calcId5FromVoxel(voxelIsWetSoil);
    const soilId9 = calcId9FromVoxel(voxelIsWetSoil);

    switch (soilId9) {
        case calcId9FromHights([0, 0, 0, 0, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_3_0"];
        case calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_3_1"];
        case calcId9FromHights([0, 0, 0, 1, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_3_2"];
        case calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_3_3"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_3_4"];
        case calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_3_5"];
        case calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_3_6"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_3_7"];
        case calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_3_8"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_4_0"];
        case calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_wet_0_4_1"];
        case calcId9FromHights([0, 0, 0, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_wet_0_4_2"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_4_3"];
        case calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_wet_0_4_4"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_wet_0_4_5"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_wet_0_4_6"];
        case calcId9FromHights([0, 1, 0, 1, 1, 0, 1, 1, 0]):
            return [...baseSprites, "soil_wet_0_4_7"];
        case calcId9FromHights([0, 1, 1, 0, 1, 1, 0, 1, 0]):
        case calcId9FromHights([1, 1, 1, 0, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_4_8"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_wet_0_4_9"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_wet_0_4_10"];
        case calcId9FromHights([1, 1, 0, 1, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_4_11"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_wet_0_4_12"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_4_13"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_4_14"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_wet_0_4_15"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_wet_0_5_1"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_wet_0_5_5"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 0]):
            return [...baseSprites, "soil_wet_0_5_7"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_wet_0_5_9"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_wet_0_5_10"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_5_14"];

        default:
            break;
    }

    switch (soilId5) {
        case calcId5FromHights([0, 0, 0, 0, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_0_0"];
        case calcId5FromHights([0, 1, 0, 0, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_1_0"];
        case calcId5FromHights([0, 1, 0, 0, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_1_1"];
        case calcId5FromHights([0, 0, 0, 0, 1, 0, 0, 1, 0]):
            return [...baseSprites, "soil_wet_0_1_2"];
        case calcId5FromHights([0, 0, 0, 0, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_2_0"];
        case calcId5FromHights([0, 0, 0, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_2_1"];
        case calcId5FromHights([0, 0, 0, 1, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_2_2"];

        case calcId5FromHights([0, 0, 0, 0, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_wet_0_5_0"];
        case calcId5FromHights([0, 0, 0, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_wet_0_5_2"];
        case calcId5FromHights([0, 0, 0, 1, 1, 0, 1, 1, 0]):
            return [...baseSprites, "soil_wet_0_5_3"];
        case calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 1, 1]):
            return [...baseSprites, "soil_wet_0_5_4"];
        case calcId5FromHights([1, 1, 1, 1, 1, 1, 1, 1, 1]):
            return [...baseSprites, "soil_wet_0_5_9"];
        case calcId5FromHights([1, 1, 0, 1, 1, 0, 1, 1, 0]):
            return [...baseSprites, "soil_wet_0_5_11"];
        case calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_5_12"];
        case calcId5FromHights([1, 1, 1, 1, 1, 1, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_5_13"];
        case calcId5FromHights([1, 1, 0, 1, 1, 0, 0, 0, 0]):
            return [...baseSprites, "soil_wet_0_5_15"];

        default:
            return [...baseSprites, "soil_wet_0_5_9"];
    }
}

// -----------------------------------------------------------------------------
// 草地スプライト名の解決
// -----------------------------------------------------------------------------

export function grassSpritesName(pos: Pos3D[], centerHight: number): string[] {
    const hightId5 = calcId5FromPos3D(pos);
    const hightId9 = calcId9FromPos3D(pos);
    switch (hightId9) {
        case calcId9FromHights([0, 0, 0, 0, 1, 1, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_3_0"];
        case calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_3_1"];
        case calcId9FromHights([0, 0, 0, 1, 1, 0, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_3_2"];
        case calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_3_3"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_3_4"];
        case calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_3_5"];
        case calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_3_6"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_3_7"];
        case calcId9FromHights([0, 1, 0, 1, 1, 0, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_3_8"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_0"];
        case calcId9FromHights([0, 0, 0, 1, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_1"];
        case calcId9FromHights([0, 0, 0, 1, 1, 1, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_2"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_3"];
        case calcId9FromHights([0, 1, 0, 0, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_4"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_5"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_6"];
        case calcId9FromHights([0, 1, 0, 1, 1, 0, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_7"];
        case calcId9FromHights([0, 1, 1, 0, 1, 1, 0, 1, 0]):
        case calcId9FromHights([1, 1, 1, 0, 1, 1, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_8"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_9"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_10"];
        case calcId9FromHights([1, 1, 0, 1, 1, 0, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_11"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_12"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_13"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_14"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_4_15"];
        case calcId9FromHights([0, 1, 0, 1, 1, 1, 1, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_1"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_5"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_7"];
        case calcId9FromHights([0, 1, 1, 1, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_8"];
        case calcId9FromHights([1, 1, 0, 1, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_10"];
        case calcId9FromHights([1, 1, 1, 1, 1, 1, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_14"];

        case calcId9FromHights([1, 1, 1, 1, 2, 2, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_3_0"];
        case calcId9FromHights([1, 1, 1, 2, 2, 2, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_3_1"];
        case calcId9FromHights([1, 1, 1, 2, 2, 1, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_3_2"];
        case calcId9FromHights([1, 2, 1, 1, 2, 2, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_3_3"];
        case calcId9FromHights([1, 2, 1, 2, 2, 2, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_3_4"];
        case calcId9FromHights([1, 2, 1, 2, 2, 1, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_3_5"];
        case calcId9FromHights([1, 2, 1, 1, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_3_6"];
        case calcId9FromHights([1, 2, 1, 2, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_3_7"];
        case calcId9FromHights([1, 2, 1, 2, 2, 1, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_3_8"];
        case calcId9FromHights([2, 2, 1, 2, 2, 2, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_0"];
        case calcId9FromHights([1, 1, 1, 2, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_1"];
        case calcId9FromHights([1, 1, 1, 2, 2, 2, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_2"];
        case calcId9FromHights([1, 2, 2, 2, 2, 2, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_3"];
        case calcId9FromHights([1, 2, 1, 1, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_4"];
        case calcId9FromHights([1, 2, 2, 2, 2, 2, 2, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_5"];
        case calcId9FromHights([2, 2, 1, 2, 2, 2, 2, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_6"];
        case calcId9FromHights([1, 2, 1, 2, 2, 1, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_7"];
        case calcId9FromHights([1, 2, 2, 1, 2, 2, 1, 2, 1]):
        case calcId9FromHights([2, 2, 2, 1, 2, 2, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_8"];
        case calcId9FromHights([2, 2, 2, 2, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_9"];
        case calcId9FromHights([2, 2, 2, 2, 2, 2, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_10"];
        case calcId9FromHights([2, 2, 1, 2, 2, 1, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_11"];
        case calcId9FromHights([1, 2, 1, 2, 2, 2, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_12"];
        case calcId9FromHights([1, 2, 2, 2, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_13"];
        case calcId9FromHights([2, 2, 1, 2, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_14"];
        case calcId9FromHights([1, 2, 1, 2, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_4_15"];
        case calcId9FromHights([1, 2, 1, 2, 2, 2, 2, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_1"];
        case calcId9FromHights([1, 2, 2, 2, 2, 2, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_5"];
        case calcId9FromHights([2, 2, 1, 2, 2, 2, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_7"];
        case calcId9FromHights([1, 2, 2, 2, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_8"];
        case calcId9FromHights([2, 2, 1, 2, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_10"];
        case calcId9FromHights([2, 2, 2, 2, 2, 2, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_14"];

        default:
            break;
    }

    switch (hightId5) {
        case calcId5FromHights([0, 0, 0, 0, 1, 0, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_0_0"];
        case calcId5FromHights([0, 1, 0, 0, 1, 0, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_1_0"];
        case calcId5FromHights([0, 1, 0, 0, 1, 0, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_1_1"];
        case calcId5FromHights([0, 0, 0, 0, 1, 0, 0, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_1_2"];
        case calcId5FromHights([0, 0, 0, 0, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_2_0"];
        case calcId5FromHights([0, 0, 0, 1, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_2_1"];
        case calcId5FromHights([0, 0, 0, 1, 1, 0, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_2_2"];

        case calcId5FromHights([0, 0, 0, 0, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_0"];
        case calcId5FromHights([0, 0, 0, 1, 1, 1, 1, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_2"];
        case calcId5FromHights([0, 0, 0, 1, 1, 0, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_3"];
        case calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 1, 1]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_4"];
        case calcId5FromHights([1, 1, 1, 1, 1, 1, 1, 1, 1]):
            return ["grass_water_normal_0_5_9"];
        case calcId5FromHights([1, 1, 0, 1, 1, 0, 1, 1, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_11"];
        case calcId5FromHights([0, 1, 1, 0, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_12"];
        case calcId5FromHights([1, 1, 1, 1, 1, 1, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_13"];
        case calcId5FromHights([1, 1, 0, 1, 1, 0, 0, 0, 0]):
            return ["water_grass_normal_0_5_9", "grass_water_normal_0_5_15"];

        case calcId5FromHights([1, 1, 1, 1, 2, 1, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_0_0"];
        case calcId5FromHights([1, 2, 1, 1, 2, 1, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_1_0"];
        case calcId5FromHights([1, 2, 1, 1, 2, 1, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_1_1"];
        case calcId5FromHights([1, 1, 1, 1, 2, 1, 1, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_1_2"];
        case calcId5FromHights([1, 1, 1, 1, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_2_0"];
        case calcId5FromHights([1, 1, 1, 2, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_2_1"];
        case calcId5FromHights([1, 1, 1, 2, 2, 1, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_2_2"];

        case calcId5FromHights([1, 1, 1, 1, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_0"];
        case calcId5FromHights([1, 1, 1, 2, 2, 2, 2, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_2"];
        case calcId5FromHights([1, 1, 1, 2, 2, 1, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_3"];
        case calcId5FromHights([1, 2, 2, 1, 2, 2, 1, 2, 2]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_4"];
        case calcId5FromHights([2, 2, 2, 2, 2, 2, 2, 2, 2]):
            return ["grass_hill_dark_0_5_9"];
        case calcId5FromHights([2, 2, 1, 2, 2, 1, 2, 2, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_11"];
        case calcId5FromHights([1, 2, 2, 1, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_12"];
        case calcId5FromHights([2, 2, 2, 2, 2, 2, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_13"];
        case calcId5FromHights([2, 2, 1, 2, 2, 1, 1, 1, 1]):
            return ["grass_water_normal_0_5_9", "grass_hill_dark_0_5_15"];
        default:
            if (centerHight === 1) {
                return ["grass_water_normal_0_5_9"];
            } else if (centerHight === 2) {
                return ["grass_water_dark_0_5_9"];
            } else {
                throw new Error(`Unknown hightId: ${calcHightsFromId(hightId5)}`);
            }
    }
}

// -----------------------------------------------------------------------------
// ボクセル → スプライト名の解決
// -----------------------------------------------------------------------------

/** ボクセルデータから地形タイルのスプライト名配列を返す。 */
export function getTerrainSpriteNamesFromVoxel(voxel: number[], pos: Pos3D[]): string[] {
    const type = getTerrainTypeFromVoxel(voxel[4]);
    switch (type) {
        case TERRAIN_TYPES.water:
            return ["water_grass_normal_0_5_9"];
        case TERRAIN_TYPES.soil:
            return soilSpriteName(pos, pos[4].y, voxel);
        case TERRAIN_TYPES.wetSoil:
            return wetSoilSpriteName(pos, pos[4].y, voxel);
        case TERRAIN_TYPES.grass:
            return grassSpritesName(pos, pos[4].y);
        default:
            throw new Error(`Unknown voxel type: ${type}`);
    }
}

/** ボクセル値からエンティティタイルのスプライト名を返す。エンティティなしの場合は null。 */
export function getEntitySpriteNameFromVoxel(voxel: number): string | null {
    const type = getEntityTypeFromVoxel(voxel);
    switch (type) {
        case ENTITY_TYPES.none:
            return null;
        case ENTITY_TYPES.tree:
            return "birch_tree_sapling";
        default:
            throw new Error(`Unknown entity type: ${type}`);
    }
}
