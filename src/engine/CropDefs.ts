import { ENTITY_TYPES, FERTILIZER_TYPES } from "./TerrainDefs";

/** 作物ごとの栽培パラメータ定義。 */
export interface CropDef {
    readonly entityType: number;
    /** 成熟までの日数（day counter がこの値に達したら収穫可能）。 */
    readonly maturityDay: number;
    /** 枯死する日数（day counter がこの値に達したら枯死）。 */
    readonly witherDay: number;
    /** true の場合、毎日水やりしないと成長しない。false なら水なしでも育つ。 */
    readonly needsWater: boolean;
    /** 連作疲労がこの値以上になると植付不可（枯死扱い）。 */
    readonly fatigueThreshold: number;
}

/** 作物パラメータテーブル。entity type → CropDef のマッピング。 */
export const CROP_DEFS: Readonly<Record<number, CropDef>> = {
    [ENTITY_TYPES.potato]: {
        entityType: ENTITY_TYPES.potato,
        maturityDay: 5,
        witherDay: 10,
        needsWater: false,
        fatigueThreshold: 3,
    },
    [ENTITY_TYPES.soy]: {
        entityType: ENTITY_TYPES.soy,
        maturityDay: 4,
        witherDay: 8,
        needsWater: true,
        fatigueThreshold: 4,
    },
    [ENTITY_TYPES.flax]: {
        entityType: ENTITY_TYPES.flax,
        maturityDay: 7,
        witherDay: 14,
        needsWater: true,
        fatigueThreshold: 2,
    },
    [ENTITY_TYPES.sunflower]: {
        entityType: ENTITY_TYPES.sunflower,
        maturityDay: 3,
        witherDay: 6,
        needsWater: true,
        fatigueThreshold: 5,
    },
};

/**
 * day counter からビジュアルステージ（0-7）に変換する。
 * スプライトテーブル（cropSpriteOf が生成する 8 段階配列）のインデックスとして使う。
 *
 *   0:       seed（植えたて）
 *   1-2:     growing（成長中）
 *   3-4:     mature + star（収穫適期）
 *   5-6:     mature（収穫可能だが適期過ぎ）
 *   7:       withered（枯死）
 */
export function getVisualStage(entityType: number, dayCounter: number): number {
    const def = CROP_DEFS[entityType];
    if (!def) return Math.min(dayCounter, 7);

    // 枯死
    if (dayCounter >= def.witherDay) return 7;

    // 成熟期（収穫可能）: day maturityDay..witherDay-1 → visual 3-6
    if (dayCounter >= def.maturityDay) {
        const harvestWindow = def.witherDay - def.maturityDay;
        const dayInHarvest = dayCounter - def.maturityDay;
        const proportion = dayInHarvest / harvestWindow;
        return 3 + Math.min(3, Math.floor(proportion * 4));
    }

    // 成長期: day 0..maturityDay-1 → visual 0-2
    if (dayCounter === 0) return 0;
    const proportion = dayCounter / def.maturityDay;
    return Math.min(2, Math.floor(proportion * 3));
}

// ---------------------------------------------------------------------------
// NPK 肥料効果計算
// ---------------------------------------------------------------------------

/** 各肥料の NPK 値（窒素, リン酸, カリウム）。 */
const FERTILIZER_NPK: Readonly<Record<number, readonly [number, number, number]>> = {
    [FERTILIZER_TYPES.none]: [0, 0, 0],
    [FERTILIZER_TYPES.compost]: [0.3, 0.3, 0.3],
    [FERTILIZER_TYPES.plant_ashes]: [0, 0.5, 0.8],
    [FERTILIZER_TYPES.oil_cake]: [0.8, 0.3, 0],
};

/** 各作物の NPK 応答係数（-1〜1）。 */
const CROP_NPK_RESPONSE: Readonly<Record<number, readonly [number, number, number]>> = {
    [ENTITY_TYPES.potato]: [-0.5, 0.5, 0.8],
    [ENTITY_TYPES.soy]: [0.0, 0.5, 0.5],
    [ENTITY_TYPES.flax]: [0.6, 0.3, 0.2],
    [ENTITY_TYPES.sunflower]: [0.3, 0.3, 0.3],
};

/**
 * 肥料×作物の収量係数を返す。
 * 1.0 = 基準（無肥料）、> 1.0 で増収、< 1.0 で減収。
 */
export function getFertilizerYieldMultiplier(entityType: number, fertilizerType: number): number {
    if (fertilizerType === FERTILIZER_TYPES.none) return 0.7;

    const npk = FERTILIZER_NPK[fertilizerType];
    const response = CROP_NPK_RESPONSE[entityType];
    if (!npk || !response) return 1.0;

    const effect = npk[0] * response[0] + npk[1] * response[1] + npk[2] * response[2];
    return 0.7 + Math.max(-0.3, Math.min(1.0, effect　* 2));
}
