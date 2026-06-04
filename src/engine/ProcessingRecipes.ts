import type { ItemId } from "../_boundary/interfaces";
import { ENTITY_TYPES } from "./VoxelDefs";

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
    /** 出力スロット数（1 または 2）。UI でスロット枠を確保するために使う。 */
    readonly outputSlotCount: 1 | 2;
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
            {
                inputItemId: "hot_meteoric_iron",
                inputCountPerCycle: 1,
                outputs: [{ itemId: "iron_teeth", count: 4 }],
            },
        ],
    },
};

/** カテゴリ3: 日次処理施設のレシピテーブル。 */
export const DAILY_PROCESSING_DEFS: Readonly<Record<number, DailyProcessingDef>> = {
    [ENTITY_TYPES.compost_bin]: {
        daysRequired: 4,
        outputSlotCount: 1,
        recipes: [
            { inputItemId: "stem", inputCountPerCycle: 10, outputs: [{ itemId: "compost", count: 1 }] },
            { inputItemId: "leaves", inputCountPerCycle: 10, outputs: [{ itemId: "compost", count: 1 }] },
            { inputItemId: "crop_residue", inputCountPerCycle: 10, outputs: [{ itemId: "compost", count: 1 }] },
        ],
    },
    [ENTITY_TYPES.soaking_basket]: {
        daysRequired: 3,
        outputSlotCount: 1,
        recipes: [
            {
                inputItemId: "flax_stalk",
                inputCountPerCycle: 8,
                outputs: [{ itemId: "processed_flax", count: 8 }],
            },
        ],
    },
    // bonfire は炉型に拡張され、BonfireStorage が独自に処理する（DailyProcessing 対象外）。
    [ENTITY_TYPES.kiln]: {
        daysRequired: 4,
        outputSlotCount: 1,
        recipes: [
            {
                inputItemId: "trunk",
                inputCountPerCycle: 12,
                outputs: [{ itemId: "charcoal", count: 4 }],
            },
        ],
    },
    // 麹室（doc/26 §3.3）: 好気・短期（2日仮）。蒸麦 → 麹。
    // 種麹循環（麹を種として取り分け）は簡略化し、当面は単入力（蒸麦→麹）とする。
    [ENTITY_TYPES.koji_muro]: {
        daysRequired: 2,
        outputSlotCount: 1,
        recipes: [
            {
                inputItemId: "steamed_wheat",
                inputCountPerCycle: 8,
                outputs: [{ itemId: "koji", count: 8 }],
            },
        ],
    },
};

/**
 * 焚き火（bonfire）の拡張レシピ（doc/26 §3.2）。
 * 焚き火は炉型に拡張され、燃料スロット（→草木灰）と素材スロット（→蒸し系）を持つ。
 * 1日経過ごとに「燃料を燃やして草木灰」「素材を蒸す/炒る」を同時に行う。
 */
export const BONFIRE_FUEL_RECIPES: ReadonlyArray<ProcessingRecipe> = [
    { inputItemId: "trunk", inputCountPerCycle: 4, outputs: [{ itemId: "plant_ashes", count: 4 }] },
    { inputItemId: "stem", inputCountPerCycle: 20, outputs: [{ itemId: "plant_ashes", count: 4 }] },
];

export const BONFIRE_MATERIAL_RECIPES: ReadonlyArray<ProcessingRecipe> = [
    { inputItemId: "soybeans", inputCountPerCycle: 8, outputs: [{ itemId: "steamed_soybeans", count: 8 }] },
    { inputItemId: "wheat", inputCountPerCycle: 8, outputs: [{ itemId: "steamed_wheat", count: 8 }] },
    { inputItemId: "wheat", inputCountPerCycle: 8, outputs: [{ itemId: "roasted_wheat", count: 8 }] },
];

/** findRecipeForInput 等の `{ recipes }` ヘルパーにそのまま渡せるラッパ。 */
export const BONFIRE_FUEL_DEF = { recipes: BONFIRE_FUEL_RECIPES } as const;
export const BONFIRE_MATERIAL_DEF = { recipes: BONFIRE_MATERIAL_RECIPES } as const;

/**
 * 蒸留器（distiller）のレシピ（doc/26 §3.5）。
 * 焚き火と同じ「燃料スロット＋素材スロット」型だが、草木灰のような副産物は無く、
 * 燃料は蒸留を回すためだけに消費される（産物は麦焼酎1スロットのみ）。
 * 蒸留で量が凝縮するため n:1（麦もろみ ×n → 麦焼酎 ×1）。
 */
export const DISTILLER_MATERIAL_RECIPES: ReadonlyArray<ProcessingRecipe> = [
    { inputItemId: "wheat_moromi", inputCountPerCycle: 8, outputs: [{ itemId: "shochu", count: 2 }] },
];
export const DISTILLER_MATERIAL_DEF = { recipes: DISTILLER_MATERIAL_RECIPES } as const;
/** 蒸留器の燃料として受け入れる itemId。 */
export const DISTILLER_FUEL_ITEMS: ReadonlyArray<ItemId> = ["trunk"];
/** 1サイクル（1日）の蒸留で消費する燃料の本数。 */
export const DISTILLER_FUEL_PER_CYCLE = 1;

/** 自動処理（シャフト動力 ON のとき day_changed で全入力を一括処理）。 */
export interface AutoProcessingDef {
    /** 入力スロット数。 */
    readonly inputSlotCount: number;
    /** 出力スロット数。 */
    readonly outputSlotCount: number;
    /** entity ごとの全レシピ。入力スロットの itemId に応じて切り替える。 */
    readonly recipes: ReadonlyArray<ProcessingRecipe>;
}

/** カテゴリ4: 自動処理施設のレシピテーブル。
 *
 * 自動処理は day_changed で動力ON時に一括処理する。
 * 入出力比率は doc/17 §5.6 の手動処理と同じ。1日あたりの処理量は入力スロット数（8）に依存する。
 */
export const AUTO_PROCESSING_DEFS: Readonly<Record<number, AutoProcessingDef>> = {
    // 脱穀機: 茎付き大豆 → 大豆 + 茎
    [ENTITY_TYPES.auto_thresher]: {
        inputSlotCount: 8,
        outputSlotCount: 16,
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
    // スクリュー式搾油機: 大豆/亜麻種子 8 → 油 + 油粕（手動 screw_presses と同じレシピ）
    [ENTITY_TYPES.auto_screw_press]: {
        inputSlotCount: 8,
        outputSlotCount: 16,
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
    // スカッチングミル: 浸漬済み亜麻 → 亜麻繊維 + 屑（残渣）
    // doc/17 §5.2 で「亜麻繊維 + 屑」と明記。手動 scutching_board は副産物なしだったが、
    // 自動版は機械的に大量処理するため副産物の残渣が発生する設計。
    [ENTITY_TYPES.scutching_mill]: {
        inputSlotCount: 8,
        outputSlotCount: 16,
        recipes: [
            {
                inputItemId: "processed_flax",
                inputCountPerCycle: 1,
                outputs: [
                    { itemId: "flax_fiber", count: 1 },
                    { itemId: "crop_residue", count: 1 },
                ],
            },
        ],
    },
    // 紡績機: 亜麻繊維 → 糸（手動 spinning_wheel と同じレシピ）
    [ENTITY_TYPES.spinning_machine]: {
        inputSlotCount: 8,
        outputSlotCount: 16,
        recipes: [
            {
                inputItemId: "flax_fiber",
                inputCountPerCycle: 1,
                outputs: [{ itemId: "thread", count: 1 }],
            },
        ],
    },
    // 自動織機: 糸 8 → リネン布（手動 loom と同じレシピ。袋は手動クラフト）
    [ENTITY_TYPES.auto_loom]: {
        inputSlotCount: 8,
        outputSlotCount: 16,
        recipes: [
            {
                inputItemId: "thread",
                inputCountPerCycle: 8,
                outputs: [{ itemId: "cloth", count: 1 }],
            },
        ],
    },
};

/** entity に対応する自動処理定義を返す。未登録なら null。 */
export function getAutoProcessingDef(entityType: number): AutoProcessingDef | null {
    return AUTO_PROCESSING_DEFS[entityType] ?? null;
}

/** entity に対応する手動処理定義を返す。未登録なら null。 */
export function getManualProcessingDef(entityType: number): ManualProcessingDef | null {
    return MANUAL_PROCESSING_DEFS[entityType] ?? null;
}

/** entity に対応する日次処理定義を返す。未登録なら null。 */
export function getDailyProcessingDef(entityType: number): DailyProcessingDef {
    const def = DAILY_PROCESSING_DEFS[entityType];
    if (def === undefined) throw new Error(`No daily processing def for entity type ${entityType}`);
    return def;
}

/**
 * 入力スロットの itemId にマッチするレシピを全て返す。マッチなしなら空配列。
 * 同じ入力で複数のレシピ（例: 金床の刃と扱き歯）が登録されていることがあるため、
 * 単数取得の `findRecipeForInput` と併用する。
 */
export function findAllRecipesForInput(def: { recipes: ReadonlyArray<ProcessingRecipe> }, inputItemId: ItemId): ProcessingRecipe[] {
    return def.recipes.filter((r) => r.inputItemId === inputItemId);
}

/**
 * 入力スロットの itemId に対応するレシピを返す。マッチなしなら例外。
 * 同じ入力に複数レシピが存在する場合は `selectedIndex` で選択する（範囲外なら 0 にクランプ）。
 */
export function findRecipeForInput(def: { recipes: ReadonlyArray<ProcessingRecipe> }, inputItemId: ItemId, selectedIndex = 0): ProcessingRecipe {
    const matches = findAllRecipesForInput(def, inputItemId);
    if (matches.length === 0) throw new Error(`No recipe for input item ${inputItemId}`);
    const idx = selectedIndex >= 0 && selectedIndex < matches.length ? selectedIndex : 0;
    return matches[idx];
}

/** 入力スロットがこの施設で受理可能な itemId かどうか。 */
export function isAcceptableInputItem(def: { recipes: ReadonlyArray<ProcessingRecipe> }, itemId: ItemId): boolean {
    return def.recipes.some((r) => r.inputItemId === itemId);
}

export function hasEnoughInput(def: { recipes: ReadonlyArray<ProcessingRecipe> }, inputItemId: ItemId, inputCount: number): boolean {
    const recipe = findRecipeForInput(def, inputItemId);
    return recipe !== null && recipe.inputCountPerCycle <= inputCount;
}
