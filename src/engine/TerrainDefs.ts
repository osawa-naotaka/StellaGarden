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
} as const;

/** ボクセル値から地形タイプを取り出す。 */
export function getTerrainTypeFromVoxel(voxel: number): number {
    return voxel & 0x000000ff;
}

/** ボクセル値からエンティティタイプを取り出す。 */
export function getEntityTypeFromVoxel(voxel: number): number {
    return (voxel >> 8) & 0x000000ff;
}
