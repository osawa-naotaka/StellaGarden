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
    stone: 16,
    chest: 17,
} as const;

// ---------------------------------------------------------------------------
// ビットフィールドレイアウト
//
//   bits  0- 7: terrain type      (8bit)
//   bits  8-15: entity type       (8bit)
//   bits 16-19: growth day counter (4bit, 0-15)
//   bits 20-21: fertilizer type   (2bit, 0=none/1=compost/2=plant_ashes/3=oil_cake)
//   bits 22-23: drought counter   (2bit, 0-3)
//   bits 24-26: last_crop         (3bit, entity type of previous crop)
//   bits 27-29: fatigue           (3bit, 0-7)
//   bits 30-31: free              (2bit)
// ---------------------------------------------------------------------------

/** 肥料タイプの定数。 */
export const FERTILIZER_TYPES = {
    none: 0,
    compost: 1,
    plant_ashes: 2,
    oil_cake: 3,
} as const;

/** ボクセル値から地形タイプを取り出す。 */
export function getTerrainTypeFromVoxel(voxel: number): number {
    return voxel & 0xff;
}

/** ボクセル値からエンティティタイプを取り出す。 */
export function getEntityTypeFromVoxel(voxel: number): number {
    return (voxel >> 8) & 0xff;
}

/**
 * ボクセル値から作物の育成日カウンタを取り出す（bits 16-19、4bit）。
 * 0 = 植えたて、1〜 = 経過日数。
 */
export function getCropGrowthStageFromVoxel(voxel: number): number {
    return (voxel >> 16) & 0xf;
}

/**
 * ボクセル値に育成日カウンタを書き込んだ新しい値を返す（bits 16-19）。
 * 元の値は変更しない（純粋関数）。
 */
export function setCropGrowthStageInVoxel(voxel: number, stage: number): number {
    return (voxel & ~(0xf << 16)) | ((stage & 0xf) << 16);
}

/**
 * ボクセル値から肥料タイプを取り出す（bits 20-21、2bit）。
 * 0 = 未施肥、1 = compost、2 = plant_ashes、3 = oil_cake。
 */
export function getFertilizerTypeFromVoxel(voxel: number): number {
    return (voxel >> 20) & 0x3;
}

/**
 * ボクセル値に肥料タイプを書き込んだ新しい値を返す（bits 20-21）。
 * 元の値は変更しない（純粋関数）。
 */
export function setFertilizerTypeInVoxel(voxel: number, fertType: number): number {
    return (voxel & ~(0x3 << 20)) | ((fertType & 0x3) << 20);
}

/** 後方互換: 施肥済みかどうかを返す。 */
export function getFertilizedFromVoxel(voxel: number): boolean {
    return getFertilizerTypeFromVoxel(voxel) !== 0;
}

/** 後方互換: 施肥フラグを書き込む。true → compost(1), false → none(0)。 */
export function setFertilizedInVoxel(voxel: number, fertilized: boolean): number {
    return setFertilizerTypeInVoxel(voxel, fertilized ? FERTILIZER_TYPES.compost : FERTILIZER_TYPES.none);
}

/**
 * ボクセル値から水切れカウンタを取り出す（bits 22-23、2bit）。
 * 水やり必須作物: 連続水切れ日数（3で枯死）。
 * ジャガイモ: 水やり回数カウント（収量ボーナス用）。
 */
export function getDroughtCounterFromVoxel(voxel: number): number {
    return (voxel >> 22) & 0x3;
}

/** ボクセル値に水切れカウンタを書き込んだ新しい値を返す（bits 22-23）。 */
export function setDroughtCounterInVoxel(voxel: number, count: number): number {
    return (voxel & ~(0x3 << 22)) | ((count & 0x3) << 22);
}

/**
 * ボクセル値から前作の作物タイプを取り出す（bits 24-26、3bit）。
 * ENTITY_TYPES の値（0=none, 2=potato, 3=soy, 4=flax, 5=sunflower）。
 */
export function getLastCropFromVoxel(voxel: number): number {
    return (voxel >> 24) & 0x7;
}

/** ボクセル値に前作の作物タイプを書き込んだ新しい値を返す（bits 24-26）。 */
export function setLastCropInVoxel(voxel: number, cropType: number): number {
    return (voxel & ~(0x7 << 24)) | ((cropType & 0x7) << 24);
}

/**
 * ボクセル値から連作疲労カウンタを取り出す（bits 27-29、3bit、0-7）。
 */
export function getFatigueFromVoxel(voxel: number): number {
    return (voxel >> 27) & 0x7;
}

/** ボクセル値に連作疲労カウンタを書き込んだ新しい値を返す（bits 27-29）。 */
export function setFatigueInVoxel(voxel: number, fatigue: number): number {
    return (voxel & ~(0x7 << 27)) | ((fatigue & 0x7) << 27);
}
