/** 地形タイプの定数。ボクセル値の下位 8 ビットに格納される。 */
export const TERRAIN_TYPES = {
    empty: 0,
    water: 1,
    grass: 2,
    soil: 3,
    wetSoil: 4,
} as const;

/** エンティティタイプの定数。ボクセル値の 8〜15 ビット目に格納される。 */
export const ENTITY_TYPES = {
    none: 0,
    tree: 1,
    potato: 2,
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
 * 0 = 植えたて（seed）、1〜5 = potato_1〜potato_5。
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
