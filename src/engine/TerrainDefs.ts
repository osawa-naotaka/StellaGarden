/** 地形タイプの定数。ボクセル値の下位 8 ビットに格納される。 */
export const TERRAIN_TYPES = {
    empty: 0,
    water: 1,
    grass: 2,
    soil: 3,
    wetSoil: 4,
    dirt: 5,
    waterSource: 6,
    disorderedSoil: 7,
} as const;

/** エンティティタイプの定数。ボクセル値の 8〜15 ビット目に格納される。 */
export const ENTITY_TYPES = {
    none: 0,
    tree: 1,
    potato: 2,
    soy: 3,
    flax: 4,
    sunflower: 5,
    workbench: 6,
    facility_part: 7,
    forge: 8,
    compost_bin: 9,
    threshing_machine: 10,
    screw_presses: 11,
    soaking_basket: 12,
    scutching_board: 13,
    spinning_wheel: 14,
    loom: 15,
} as const;

/** ボクセル値から地形タイプを取り出す。 */
export function getTerrainTypeFromVoxel(voxel: number): number {
    return voxel & 0x000000ff;
}

/** ボクセル値からエンティティタイプを取り出す。 */
export function getEntityTypeFromVoxel(voxel: number): number {
    return (voxel >> 8) & 0x000000ff;
}

/**
 * ボクセル値から作物の育成カウンタを取り出す（bits 16-18、3bit）。
 * 0 = 植えたて（seed）、1〜3 = potato_1〜potato_3。
 */
export function getCropGrowthStageFromVoxel(voxel: number): number {
    return (voxel >> 16) & 0x7;
}

/**
 * ボクセル値に育成カウンタを書き込んだ新しい値を返す（bits 16-18）。
 * 元の値は変更しない（純粋関数）。
 */
export function setCropGrowthStageInVoxel(voxel: number, stage: number): number {
    return (voxel & ~(0x7 << 16)) | ((stage & 0x7) << 16);
}
