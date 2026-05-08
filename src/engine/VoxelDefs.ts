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
    bonfire: 18,
    kiln: 19,
    // bonfire_lit: 20,
    // bonfire_done: 21,
    kiln_burning: 22,
    compost_bin_loaded: 23,
    compost_bin_fermenting: 24,
    compost_bin_done: 25,
    clay: 26,
    meteoric_iron: 27,
    anvil: 28,
    forge_burning: 29,
    pipe1: 30,
    warp_gate: 31,
    soaking_basket_loaded: 32,
    soaking_basket_done: 33,
    rail: 34,
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
//   bit     30: pipe variant      (1bit, 0=horizontal/1=vertical)
//   bits 31-34: pipe connections  (4bit, up/down/left/right)
//   bit     35: pipe filled       (1bit, 0=dry/1=filled)
// ---------------------------------------------------------------------------

/** 肥料タイプの定数。 */
export const FERTILIZER_TYPES = {
    none: 0,
    compost: 1,
    plant_ashes: 2,
    oil_cake: 3,
} as const;

/** ボクセル値から地形タイプを取り出す。 */
export function getTerrainTypeFromVoxel(voxel: bigint): number {
    return Number(voxel & 0xffn);
}

export function initializeVoxel(terrainType: number): bigint {
    return BigInt(terrainType) & 0xffn;
}

export function setTerrainTypeInVoxel(voxel: bigint, terrainType: number): bigint {
    return (voxel & ~0xffn) | (BigInt(terrainType) & 0xffn);
}

/** ボクセル値からエンティティタイプを取り出す。 */
export function getEntityTypeFromVoxel(voxel: bigint): number {
    return Number((voxel >> 8n) & 0xffn);
}

export function setEntityTypeInVoxel(voxel: bigint, entityType: number): bigint {
    return (voxel & ~(0xffn << 8n)) | ((BigInt(entityType) & 0xffn) << 8n);
}

export function clearEntityTypeInVoxel(voxel: bigint): bigint {
    return voxel & ~(0xffn << 8n);
}

/**
 * ボクセル値から作物の育成日カウンタを取り出す（bits 16-19、4bit）。
 * 0 = 植えたて、1〜 = 経過日数。
 */
export function getDaysElapsedFromVoxel(voxel: bigint): number {
    return Number((voxel >> 16n) & 0xfn);
}

/**
 * ボクセル値に育成日カウンタを書き込んだ新しい値を返す（bits 16-19）。
 * 元の値は変更しない（純粋関数）。
 */
export function setDaysElapsedInVoxel(voxel: bigint, stage: number): bigint {
    return (voxel & ~(0xfn << 16n)) | ((BigInt(stage) & 0xfn) << 16n);
}

/**
 * ボクセル値から肥料タイプを取り出す（bits 20-21、2bit）。
 * 0 = 未施肥、1 = compost、2 = plant_ashes、3 = oil_cake。
 */
export function getFertilizerTypeFromVoxel(voxel: bigint): number {
    return Number((voxel >> 20n) & 0x3n);
}

/**
 * ボクセル値に肥料タイプを書き込んだ新しい値を返す（bits 20-21）。
 * 元の値は変更しない（純粋関数）。
 */
export function setFertilizerTypeInVoxel(voxel: bigint, fertType: number): bigint {
    return (voxel & ~(0x3n << 20n)) | ((BigInt(fertType) & 0x3n) << 20n);
}

/** 後方互換: 施肥済みかどうかを返す。 */
export function getFertilizedFromVoxel(voxel: bigint): boolean {
    return getFertilizerTypeFromVoxel(voxel) !== 0;
}

/** 後方互換: 施肥フラグを書き込む。true → compost(1), false → none(0)。 */
export function setFertilizedInVoxel(voxel: bigint, fertilized: boolean): bigint {
    return setFertilizerTypeInVoxel(voxel, fertilized ? FERTILIZER_TYPES.compost : FERTILIZER_TYPES.none);
}

/**
 * ボクセル値から水切れカウンタを取り出す（bits 22-23、2bit）。
 * 水やり必須作物: 連続水切れ日数（3で枯死）。
 */
export function getDroughtCounterFromVoxel(voxel: bigint): number {
    return Number((voxel >> 22n) & 0x3n);
}

/** ボクセル値に水切れカウンタを書き込んだ新しい値を返す（bits 22-23）。 */
export function setDroughtCounterInVoxel(voxel: bigint, count: number): bigint {
    return (voxel & ~(0x3n << 22n)) | ((BigInt(count) & 0x3n) << 22n);
}

/**
 * ボクセル値から前作の作物タイプを取り出す（bits 24-26、3bit）。
 * ENTITY_TYPES の値（0=none, 2=potato, 3=soy, 4=flax, 5=sunflower）。
 */
export function getLastCropFromVoxel(voxel: bigint): number {
    return Number((voxel >> 24n) & 0x7n);
}

/** ボクセル値に前作の作物タイプを書き込んだ新しい値を返す（bits 24-26）。 */
export function setLastCropInVoxel(voxel: bigint, cropType: number): bigint {
    return (voxel & ~(0x7n << 24n)) | ((BigInt(cropType) & 0x7n) << 24n);
}

/**
 * ボクセル値から連作疲労カウンタを取り出す（bits 27-29、3bit、0-7）。
 */
export function getFatigueFromVoxel(voxel: bigint): number {
    return Number((voxel >> 27n) & 0x7n);
}

/** ボクセル値に連作疲労カウンタを書き込んだ新しい値を返す（bits 27-29）。 */
export function setFatigueInVoxel(voxel: bigint, fatigue: number): bigint {
    return (voxel & ~(0x7n << 27n)) | ((BigInt(fatigue) & 0x7n) << 27n);
}

// /** 畝間水路の向き。false = horizontal, true = vertical。 */
// export function getPipeVariantFromVoxel(voxel: bigint): boolean {
//     return ((voxel >> 30n) & 0x1n) === 0x1n;
// }

// /** 畝間水路の向きビットを書き込んだ新しい値を返す（bit 30）。 */
// export function setPipeVariantInVoxel(voxel: bigint, vertical: boolean): bigint {
//     return (voxel & ~(0x1n << 30n)) | ((vertical ? 1n : 0n) << 30n);
// }

/** 畝間水路の接続マスクを取り出す（bits 31-34）。 */
export function getPipeConnectionsFromVoxel(voxel: bigint): number {
    return Number((voxel >> 31n) & 0xfn);
}

/** 畝間水路の接続マスクを書き込んだ新しい値を返す（bits 31-34）。 */
export function setPipeConnectionsInVoxel(voxel: bigint, mask: number): bigint {
    return (voxel & ~(0xfn << 31n)) | ((BigInt(mask) & 0xfn) << 31n);
}

/** 畝間水路に水が満たされているかどうかを返す（bit 35）。 */
export function getPipeFilledFromVoxel(voxel: bigint): boolean {
    return ((voxel >> 35n) & 0x1n) === 0x1n;
}

/** 畝間水路の通水ビットを書き込んだ新しい値を返す（bit 35）。 */
export function setPipeFilledInVoxel(voxel: bigint, filled: boolean): bigint {
    return (voxel & ~(0x1n << 35n)) | ((filled ? 1n : 0n) << 35n);
}

/** エンティティのバリアントを取り出す（bit 36-38）。 */
export function getVariantFromVoxel(voxel: bigint): number {
    return Number((voxel >> 36n) & 0x7n);
}

/** エンティティのバリアントを書き込んだ新しい値を返す（bit 36-38）。 */
export function setVariantInVoxel(voxel: bigint, variant: number): bigint {
    return (voxel & ~(0x7n << 36n)) | ((BigInt(variant) & 0x7n) << 36n);
}

export const VOXEL_VARIANT = {
    "base": 0,
    "done": 1,
};
