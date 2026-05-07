import type { ItemId } from "../_boundary/interfaces";
import { ENTITY_TYPES } from "./TerrainDefs";

/**
 * 処理レシピ。1サイクルで「inputItemId × inputCountPerCycle」を消費し、outputs を生成する。
 * 出力は1〜2スロット（メインと副産物）。
 */
export interface ProcessingRecipe {
    readonly inputItemId: ItemId;
    readonly inputCountPerCycle: number;
    readonly outputs: ReadonlyArray<{ readonly itemId: ItemId; readonly count: number }>;
}

/** 手動処理（処理ボタン押下中に一定間隔で1サイクル実行）。 */
export interface ManualProcessingDef {
    /** 1サイクルあたりの処理間隔（ms）。 */
    readonly intervalMS: number;
    /** 出力スロット数（1 または 2）。UI でスロット枠を確保するために使う。 */
    readonly outputSlotCount: 1 | 2;
    /** entity ごとの全レシピ。入力スロットの itemId に応じて切り替える。 */
    readonly recipes: ReadonlyArray<ProcessingRecipe>;
}

/** 日次処理（入力が必要数に達したら N 日後に1サイクル実行）。 */
export interface DailyProcessingDef {
    /** 入力が揃ってから完了までの日数。 */
    readonly daysRequired: number;
    /** entity ごとの全レシピ。入力スロットの itemId に応じて切り替える。 */
    readonly recipes: ReadonlyArray<ProcessingRecipe>;
}

/** カテゴリ2: 手動処理施設のレシピテーブル。 */
export const MANUAL_PROCESSING_DEFS: Readonly<Record<number, ManualProcessingDef>> = {
    [ENTITY_TYPES.threshing_machine]: {
        intervalMS: 600,
        outputSlotCount: 2,
        recipes: [
            {
                inputItemId: "pods",
                inputCountPerCycle: 1,
                outputs: [
                    { itemId: "soybeans", count: 1 },
                    { itemId: "stem", count: 1 },
                ],
            },
        ],
    },
    [ENTITY_TYPES.screw_presses]: {
        intervalMS: 800,
        outputSlotCount: 2,
        recipes: [
            {
                inputItemId: "soybeans",
                inputCountPerCycle: 8,
                outputs: [
                    { itemId: "soybean_oil", count: 1 },
                    { itemId: "oil_cake", count: 1 },
                ],
            },
            {
                inputItemId: "flaxseed",
                inputCountPerCycle: 8,
                outputs: [
                    { itemId: "flaxseed_oil", count: 1 },
                    { itemId: "oil_cake", count: 1 },
                ],
            },
        ],
    },
    [ENTITY_TYPES.scutching_board]: {
        intervalMS: 600,
        outputSlotCount: 1,
        recipes: [
            {
                inputItemId: "processed_flax",
                inputCountPerCycle: 1,
                outputs: [{ itemId: "flax_fiber", count: 1 }],
            },
        ],
    },
    [ENTITY_TYPES.spinning_wheel]: {
        intervalMS: 800,
        outputSlotCount: 1,
        recipes: [
            {
                inputItemId: "flax_fiber",
                inputCountPerCycle: 1,
                outputs: [{ itemId: "thread", count: 1 }],
            },
        ],
    },
    [ENTITY_TYPES.loom]: {
        intervalMS: 1000,
        outputSlotCount: 1,
        recipes: [
            {
                inputItemId: "thread",
                inputCountPerCycle: 8,
                outputs: [{ itemId: "cloth", count: 1 }],
            },
        ],
    },
    [ENTITY_TYPES.anvil]: {
        intervalMS: 600,
        outputSlotCount: 1,
        recipes: [
            {
                inputItemId: "hot_meteoric_iron",
                inputCountPerCycle: 1,
                outputs: [{ itemId: "blade", count: 1 }],
            },
        ],
    },
};

/** カテゴリ3: 日次処理施設のレシピテーブル。 */
export const DAILY_PROCESSING_DEFS: Readonly<Record<number, DailyProcessingDef>> = {
    [ENTITY_TYPES.compost_bin]: {
        daysRequired: 4,
        recipes: [
            { inputItemId: "stem", inputCountPerCycle: 10, outputs: [{ itemId: "compost", count: 1 }] },
            { inputItemId: "leaves", inputCountPerCycle: 10, outputs: [{ itemId: "compost", count: 1 }] },
            { inputItemId: "crop_residue", inputCountPerCycle: 10, outputs: [{ itemId: "compost", count: 1 }] },
        ],
    },
    [ENTITY_TYPES.soaking_basket]: {
        daysRequired: 3,
        recipes: [
            {
                inputItemId: "flax_stalk",
                inputCountPerCycle: 8,
                outputs: [{ itemId: "processed_flax", count: 8 }],
            },
        ],
    },
    [ENTITY_TYPES.bonfire]: {
        daysRequired: 1,
        recipes: [
            { inputItemId: "trunk", inputCountPerCycle: 4, outputs: [{ itemId: "plant_ashes", count: 4 }] },
            { inputItemId: "stem", inputCountPerCycle: 20, outputs: [{ itemId: "plant_ashes", count: 4 }] },
        ],
    },
    [ENTITY_TYPES.kiln]: {
        daysRequired: 4,
        recipes: [
            {
                inputItemId: "trunk",
                inputCountPerCycle: 12,
                outputs: [{ itemId: "charcoal", count: 12 }],
            },
        ],
    },
};

/** entity に対応する手動処理定義を返す。未登録なら null。 */
export function getManualProcessingDef(entityType: number): ManualProcessingDef | null {
    return MANUAL_PROCESSING_DEFS[entityType] ?? null;
}

/** entity に対応する日次処理定義を返す。未登録なら null。 */
export function getDailyProcessingDef(entityType: number): DailyProcessingDef | null {
    return DAILY_PROCESSING_DEFS[entityType] ?? null;
}

/** 入力スロットの itemId に対応するレシピを返す。マッチなしなら null。 */
export function findRecipeForInput(def: { recipes: ReadonlyArray<ProcessingRecipe> }, inputItemId: ItemId): ProcessingRecipe | null {
    return def.recipes.find((r) => r.inputItemId === inputItemId) ?? null;
}

/** 入力スロットがこの施設で受理可能な itemId かどうか。 */
export function isAcceptableInputItem(def: { recipes: ReadonlyArray<ProcessingRecipe> }, itemId: ItemId): boolean {
    return def.recipes.some((r) => r.inputItemId === itemId);
}
