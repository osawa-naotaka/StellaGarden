/** 地形タイプの定数。ボクセル値の bits 0-4（5bit）に格納される。 */
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

/**
 * エンティティタイプの定数。ボクセル値の bits 24-31（8bit）に格納される。
 *
 * 番号割り当て（後方互換性は破棄して詰め直し済み）:
 *   1-31  : 農作物用に予約（last_crop が 5bit のためそのまま代入可能）
 *   32    : facility_part（anchor タイルへの displacement を持つ特別なエンティティ）
 *   33-   : その他のエンティティを連番で割り当て
 */
export const ENTITY_TYPES = {
    none: 0,
    // --- 農作物（1-31 を予約。last_crop に直接代入する） ---
    potato: 1,
    soy: 2,
    flax: 3,
    sunflower: 4,
    wheat: 5,
    // --- facility_part ---
    facility_part: 32,
    // --- その他のエンティティ（33 以降） ---
    tree: 33,
    workbench: 34,
    forge: 35,
    compost_bin: 36,
    threshing_machine: 37,
    screw_presses: 38,
    soaking_basket: 39,
    scutching_board: 40,
    spinning_wheel: 41,
    loom: 42,
    stone: 43,
    chest: 44,
    bonfire: 45,
    kiln: 46,
    clay: 47,
    meteoric_iron: 48,
    anvil: 49,
    forge_burning: 50,
    furrow_canal: 51,
    warp_gate: 52,
    rail: 53,
    waterwheel: 54,
    shaft: 55,
    auto_thresher: 56,
    winch: 57,
    cart: 58,
    auto_screw_press: 59,
    scutching_mill: 60,
    spinning_machine: 61,
    auto_loom: 62,
    station: 63,
    // --- 醸造・発酵（doc/26） ---
    distiller: 64,
    saltpan: 65,
    koji_muro: 66,
    fermentation_vat: 67,
} as const;

// ---------------------------------------------------------------------------
// ビットフィールドレイアウト（後方互換性なし・新規割り当て）
//
//   bits  0- 4: terrain type      (5bit)
//   bits  5- 7: fertilizer type   (3bit)
//   bits  8- 9: drought counter   (2bit)
//   bits 10-14: last crop         (5bit)
//   bits 15-16: fatigue           (2bit)
//   bits 17-23: days elapsed      (7bit)
//   bits 24-31: entity type       (8bit)
//   bits 32-35: entity variant    (4bit)
//   bits    36: enabled           (1bit)
//   bits    37: rotated/tracted   (1bit)
//   bits 38-39: direction         (2bit)
//   bits 40-43: connections       (4bit)
//
// entity type が facility_part のときに限り、bits 32-37 は以下に読み替える。
// このとき entity variant / enabled / rotated は使用しない。
//   bits 32-34: displacement to anchor X (3bit)
//   bits 35-37: displacement to anchor Z (3bit)
// ---------------------------------------------------------------------------

/** 肥料タイプの定数。 */
export const FERTILIZER_TYPES = {
    none: 0,
    compost: 1,
    plant_ashes: 2,
    oil_cake: 3,
} as const;

/** ボクセル値から地形タイプを取り出す（bits 0-4）。 */
export function getTerrainTypeFromVoxel(voxel: bigint): number {
    return Number(voxel & 0x1fn);
}

export function initializeVoxel(terrainType: number): bigint {
    return BigInt(terrainType) & 0x1fn;
}

export function setTerrainTypeInVoxel(voxel: bigint, terrainType: number): bigint {
    return (voxel & ~0x1fn) | (BigInt(terrainType) & 0x1fn);
}

/** ボクセル値から肥料タイプを取り出す（bits 5-7）。 */
export function getFertilizerTypeFromVoxel(voxel: bigint): number {
    return Number((voxel >> 5n) & 0x7n);
}

/** ボクセル値に肥料タイプを書き込んだ新しい値を返す（bits 5-7）。 */
export function setFertilizerTypeInVoxel(voxel: bigint, fertType: number): bigint {
    return (voxel & ~(0x7n << 5n)) | ((BigInt(fertType) & 0x7n) << 5n);
}

/** 施肥済みかどうかを返す。 */
export function getFertilizedFromVoxel(voxel: bigint): boolean {
    return getFertilizerTypeFromVoxel(voxel) !== 0;
}

/** 施肥フラグを書き込む。true → compost(1), false → none(0)。 */
export function setFertilizedInVoxel(voxel: bigint, fertilized: boolean): bigint {
    return setFertilizerTypeInVoxel(voxel, fertilized ? FERTILIZER_TYPES.compost : FERTILIZER_TYPES.none);
}

/**
 * ボクセル値から水切れカウンタを取り出す（bits 8-9、2bit）。
 * 水やり必須作物: 連続水切れ日数（3で枯死）。
 */
export function getDroughtCounterFromVoxel(voxel: bigint): number {
    return Number((voxel >> 8n) & 0x3n);
}

/** ボクセル値に水切れカウンタを書き込んだ新しい値を返す（bits 8-9）。 */
export function setDroughtCounterInVoxel(voxel: bigint, count: number): bigint {
    return (voxel & ~(0x3n << 8n)) | ((BigInt(count) & 0x3n) << 8n);
}

/**
 * ボクセル値から前作の作物タイプを取り出す（bits 10-14、5bit）。
 * ENTITY_TYPES の値（0=none, potato/soy/flax/sunflower など）。
 */
export function getLastCropFromVoxel(voxel: bigint): number {
    return Number((voxel >> 10n) & 0x1fn);
}

/** ボクセル値に前作の作物タイプを書き込んだ新しい値を返す（bits 10-14）。 */
export function setLastCropInVoxel(voxel: bigint, cropType: number): bigint {
    return (voxel & ~(0x1fn << 10n)) | ((BigInt(cropType) & 0x1fn) << 10n);
}

/** ボクセル値から連作疲労カウンタを取り出す（bits 15-16、2bit、0-3）。 */
export function getFatigueFromVoxel(voxel: bigint): number {
    return Number((voxel >> 15n) & 0x3n);
}

/** ボクセル値に連作疲労カウンタを書き込んだ新しい値を返す（bits 15-16）。 */
export function setFatigueInVoxel(voxel: bigint, fatigue: number): bigint {
    return (voxel & ~(0x3n << 15n)) | ((BigInt(fatigue) & 0x3n) << 15n);
}

/**
 * ボクセル値から作物の育成日カウンタを取り出す（bits 17-23、7bit）。
 * 0 = 植えたて、1〜 = 経過日数。
 */
export function getDaysElapsedFromVoxel(voxel: bigint): number {
    return Number((voxel >> 17n) & 0x7fn);
}

/**
 * ボクセル値に育成日カウンタを書き込んだ新しい値を返す（bits 17-23）。
 * 元の値は変更しない（純粋関数）。
 */
export function setDaysElapsedInVoxel(voxel: bigint, stage: number): bigint {
    return (voxel & ~(0x7fn << 17n)) | ((BigInt(stage) & 0x7fn) << 17n);
}

/** ボクセル値からエンティティタイプを取り出す（bits 24-31）。 */
export function getEntityTypeFromVoxel(voxel: bigint): number {
    return Number((voxel >> 24n) & 0xffn);
}

export function setEntityTypeInVoxel(voxel: bigint, entityType: number): bigint {
    return (voxel & ~(0xffn << 24n)) | ((BigInt(entityType) & 0xffn) << 24n);
}

export function clearEntityTypeInVoxel(voxel: bigint): bigint {
    return voxel & ~(0xffn << 24n);
}

/** エンティティのバリアントを取り出す（bits 32-35、4bit）。 */
export function getVariantFromVoxel(voxel: bigint): number {
    return Number((voxel >> 32n) & 0xfn);
}

/** エンティティのバリアントを書き込んだ新しい値を返す（bits 32-35）。 */
export function setVariantInVoxel(voxel: bigint, variant: number): bigint {
    return (voxel & ~(0xfn << 32n)) | ((BigInt(variant) & 0xfn) << 32n);
}

/** enabled ビットを返す（bit 36、0=dry/disable, 1=filled/enable）。 */
export function getEnabledFromVoxel(voxel: bigint): boolean {
    return ((voxel >> 36n) & 0x1n) === 0x1n;
}

/** enabled ビットを書き込んだ新しい値を返す（bit 36）。 */
export function setEnabledInVoxel(voxel: bigint, filled: boolean): bigint {
    return (voxel & ~(0x1n << 36n)) | ((filled ? 1n : 0n) << 36n);
}

/** rotated/tracted ビットを返す（bit 37）。 */
export function getRotatedFromVoxel(voxel: bigint): boolean {
    return ((voxel >> 37n) & 0x1n) === 0x1n;
}

/** rotated/tracted ビットを書き込んだ新しい値を返す（bit 37）。 */
export function setRotatedInVoxel(voxel: bigint, rotated: boolean): bigint {
    return (voxel & ~(0x1n << 37n)) | ((rotated ? 1n : 0n) << 37n);
}

/** ボクセル値からダイレクションを取り出す（bits 38-39、2bit）。 */
export function getDirectionFromVoxel(voxel: bigint): number {
    return Number((voxel >> 38n) & 0x3n);
}

/** ボクセル値にダイレクションを書き込んだ新しい値を返す（bits 38-39）。 */
export function setDirectionInVoxel(voxel: bigint, direction: number): bigint {
    return (voxel & ~(0x3n << 38n)) | ((BigInt(direction) & 0x3n) << 38n);
}

/** 畝間水路、シャフト、レールなどの接続マスクを取り出す（bits 40-43）。 */
export function getConnectionsFromVoxel(voxel: bigint): number {
    return Number((voxel >> 40n) & 0xfn);
}

/** 畝間水路、シャフト、レールなどの接続マスクを書き込んだ新しい値を返す（bits 40-43）。 */
export function setConnectionsInVoxel(voxel: bigint, mask: number): bigint {
    return (voxel & ~(0xfn << 40n)) | ((BigInt(mask) & 0xfn) << 40n);
}

/**
 * エンティティのディスプレイスメント(X)を取り出す（bits 32-34）。
 * entity type が facility_part のときのみ有効。
 */
export function getDisplacementXFromVoxel(voxel: bigint): number {
    return Number((voxel >> 32n) & 0x7n);
}

/** エンティティのディスプレイスメント(X)を書き込んだ新しい値を返す（bits 32-34）。 */
export function setDisplacementXInVoxel(voxel: bigint, displacement: number): bigint {
    return (voxel & ~(0x7n << 32n)) | ((BigInt(displacement) & 0x7n) << 32n);
}

/**
 * エンティティのディスプレイスメント(Z)を取り出す（bits 35-37）。
 * entity type が facility_part のときのみ有効。
 */
export function getDisplacementZFromVoxel(voxel: bigint): number {
    return Number((voxel >> 35n) & 0x7n);
}

/** エンティティのディスプレイスメント(Z)を書き込んだ新しい値を返す（bits 35-37）。 */
export function setDisplacementZInVoxel(voxel: bigint, displacement: number): bigint {
    return (voxel & ~(0x7n << 35n)) | ((BigInt(displacement) & 0x7n) << 35n);
}

export function placeEntity(voxel: bigint, entityType: number): bigint {
    let updatedVoxel = setEntityTypeInVoxel(voxel, entityType);
    updatedVoxel = setDisplacementXInVoxel(updatedVoxel, 0);
    updatedVoxel = setDisplacementZInVoxel(updatedVoxel, 0);
    updatedVoxel = setVariantInVoxel(updatedVoxel, 0);
    return updatedVoxel;
}

export const VOXEL_VARIANT = {
    base: 0,
    done: 1,
    horizontal: 0,
    vertical: 1,
    off: 0,
    on: 1,
};

export const VOXEL_DIRECTION = {
    forward: 0,
    backward: 1,
};
