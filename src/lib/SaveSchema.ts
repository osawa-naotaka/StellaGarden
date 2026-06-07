import * as v from "valibot";
import { StoragesSchema } from "../_registry/StorageRegistry";
import { ITEM_IDS } from "../engine/ItemDefs";

// ─── 共通プリミティブ ──────────────────────────────────────────────────────────

const Pos2DSchema = v.object({ x: v.number(), z: v.number() });

const ItemIdSchema = v.picklist(ITEM_IDS);

const ItemStackSchema = v.object({
    itemId: ItemIdSchema,
    count: v.number(),
});

const NullableItemStackSchema = v.nullable(ItemStackSchema);

const Direction8Schema = v.picklist(["down", "up", "left", "right", "down_left", "down_right", "up_left", "up_right"]);

// ─── サブスキーマ ─────────────────────────────────────────────────────────────

// TypedArray は ArrayBufferLike で定義されているため v.instance() の推論型と合わないため custom で定義する
const bigUint64ArraySchema = v.custom<BigUint64Array<ArrayBufferLike>>((val) => val instanceof BigUint64Array);
const uint32ArraySchema = v.custom<Uint32Array<ArrayBufferLike>>((val) => val instanceof Uint32Array);

export const VoxelMapSaveDataSchema = v.object({
    width: v.number(),
    height: v.number(),
    depth: v.number(),
    horizonHeight: v.number(),
    voxels: bigUint64ArraySchema,
    riversideCells: uint32ArraySchema,
});

export const PlayerStateSaveDataSchema = v.object({
    posInWorld: Pos2DSchema,
    zoomLevel: v.number(),
    facing: Direction8Schema,
});

export const InventorySaveDataSchema = v.object({
    toolbarSlots: v.array(NullableItemStackSchema),
    inventorySlots: v.array(NullableItemStackSchema),
    selectedIndex: v.number(),
});

export const GameTimeSaveDataSchema = v.object({
    elapsedMs: v.number(),
});

export const ForgeStorageSaveDataSchema = v.object({
    forges: v.array(
        v.object({
            key: v.string(),
            slots: v.object({
                ingredient: NullableItemStackSchema,
                fuel: NullableItemStackSchema,
                output: NullableItemStackSchema,
            }),
        }),
    ),
});

// 焚き火（炉型に拡張）。燃料・素材・出力2スロット＋素材レシピ選択。
export const BonfireStorageSaveDataSchema = v.object({
    bonfires: v.array(
        v.object({
            key: v.string(),
            slots: v.object({
                fuel: NullableItemStackSchema,
                material: NullableItemStackSchema,
                outputAsh: NullableItemStackSchema,
                outputSteamed: NullableItemStackSchema,
                selectedRecipeIndex: v.number(),
            }),
        }),
    ),
});

// 蒸留器（燃料＋素材＋出力1）。
export const DistillerStorageSaveDataSchema = v.object({
    distillers: v.array(
        v.object({
            key: v.string(),
            slots: v.object({
                fuel: NullableItemStackSchema,
                material: NullableItemStackSchema,
                output: NullableItemStackSchema,
                selectedRecipeIndex: v.number(),
            }),
        }),
    ),
});

// 発酵桶（多入力＋出力1＋品目選択）。
export const FermentationStorageSaveDataSchema = v.object({
    vats: v.array(
        v.object({
            key: v.string(),
            slots: v.object({
                inputs: v.array(NullableItemStackSchema),
                output: NullableItemStackSchema,
                selectedRecipeIndex: v.number(),
            }),
        }),
    ),
});

// 手動処理 / 日次処理は入力1 + 出力2のスロット構造を共有する。
// 手動処理は同じ入力に複数レシピが登録される施設（金床: 刃 / 扱き歯）があるため、
// 選択中の recipe index を `selectedRecipeIndex` として保持する。日次処理側にこの分岐は無いが、
// スキーマ簡素化のため両者で共有する。
const ProcessingSlotsSchema = v.object({
    input: NullableItemStackSchema,
    outputs: v.tuple([NullableItemStackSchema, NullableItemStackSchema]),
    selectedRecipeIndex: v.number(),
});

export const DailyProcessingStorageSaveDataSchema = v.object({
    facilities: v.array(
        v.object({
            key: v.string(),
            slots: ProcessingSlotsSchema,
        }),
    ),
});

// 自動処理施設（auto_thresher 等）は入力 8 / 出力 16 のプール構造。
// スロット数を将来変更しやすいよう、配列は固定長 tuple ではなく可変長にしている。
const AutoProcessingSlotsSchema = v.object({
    inputs: v.array(NullableItemStackSchema),
    outputs: v.array(NullableItemStackSchema),
});

export const AutoProcessingStorageSaveDataSchema = v.object({
    facilities: v.array(
        v.object({
            key: v.string(),
            slots: AutoProcessingSlotsSchema,
        }),
    ),
});

export const CartStorageSaveDataSchema = v.object({
    nextId: v.number(),
    carts: v.array(
        v.object({
            id: v.number(),
            posInWorld: Pos2DSchema,
            inventorySlots: v.array(NullableItemStackSchema),
            attachmentSlot: NullableItemStackSchema,
        }),
    ),
});

export const ReputationSaveDataSchema = v.object({
    points: v.number(),
    cumulativeShipped: v.array(v.tuple([ItemIdSchema, v.number()])),
});

/**
 * 種リクエスト（転移ゲートからの詰み救済）。保留中の種を最大1件保持する。
 */
export const SeedRequestSaveDataSchema = v.object({
    pending: v.nullable(ItemIdSchema),
});

/**
 * ミッション進捗。並列フラグモデル（doc/25_MISSION_SYSTEM.md §4.1）。
 * 達成済みのサブ ID とメイン ID を文字列配列で保持する。
 * 「現在進行中のミッション」は状態として保持せず、表示時にフラグから動的に導出する。
 *
 * triggeredDialogs: 既に表示済みの ADV 会話の scriptId 一覧（"M-01:opening" / "M-01:completion" 形式）。
 * 同じ会話の重複表示を防ぐためのフラグ。既存セーブとの互換性のため optional。
 */
export const MissionSaveDataSchema = v.object({
    completedSubs: v.array(v.string()),
    completedMains: v.array(v.string()),
    triggeredDialogs: v.optional(v.array(v.string()), () => []),
});

/**
 * 会話ログ（doc/25_MISSION_SYSTEM.md §3.3）。
 * ADV 型会話の履歴を時系列で保持する。BackLog ボタンから読み返せる。
 */
const ChatEntrySchema = v.object({
    scriptId: v.string(),
    speakerName: v.string(),
    lines: v.array(v.string()),
});

export const ChatHistorySaveDataSchema = v.object({
    entries: v.array(ChatEntrySchema),
});

// ─── ルートスキーマ ───────────────────────────────────────────────────────────

export const SaveDataSchema = v.object({
    version: v.number(),
    timestamp: v.number(),
    slotName: v.string(),
    seed: v.string(),
    voxelMap: VoxelMapSaveDataSchema,
    playerState: PlayerStateSaveDataSchema,
    inventory: InventorySaveDataSchema,
    gameTime: GameTimeSaveDataSchema,
    storage: StoragesSchema,
    bonfireStorage: BonfireStorageSaveDataSchema,
    fermentationStorage: FermentationStorageSaveDataSchema,
    autoProcessingStorage: AutoProcessingStorageSaveDataSchema,
    cartStorage: CartStorageSaveDataSchema,
    reputation: ReputationSaveDataSchema,
    mission: MissionSaveDataSchema,
    chatHistory: v.optional(ChatHistorySaveDataSchema, () => ({ entries: [] })),
    seedRequest: SeedRequestSaveDataSchema,
});

/** スロット一覧表示用の軽量ヘッダースキーマ。 */
export const SlotHeaderSchema = v.object({
    version: v.number(),
    timestamp: v.number(),
    slotName: v.string(),
});

// ─── 派生型エクスポート ───────────────────────────────────────────────────────

export type SaveData = v.InferOutput<typeof SaveDataSchema>;
export type VoxelMapSaveData = v.InferOutput<typeof VoxelMapSaveDataSchema>;
export type PlayerStateSaveData = v.InferOutput<typeof PlayerStateSaveDataSchema>;
export type InventorySaveData = v.InferOutput<typeof InventorySaveDataSchema>;
export type GameTimeSaveData = v.InferOutput<typeof GameTimeSaveDataSchema>;
export type BonfireStorageSaveData = v.InferOutput<typeof BonfireStorageSaveDataSchema>;
export type FermentationStorageSaveData = v.InferOutput<typeof FermentationStorageSaveDataSchema>;
export type DailyProcessingStorageSaveData = v.InferOutput<typeof DailyProcessingStorageSaveDataSchema>;
export type AutoProcessingStorageSaveData = v.InferOutput<typeof AutoProcessingStorageSaveDataSchema>;
export type CartStorageSaveData = v.InferOutput<typeof CartStorageSaveDataSchema>;
export type ReputationSaveData = v.InferOutput<typeof ReputationSaveDataSchema>;
export type SeedRequestSaveData = v.InferOutput<typeof SeedRequestSaveDataSchema>;
export type MissionSaveData = v.InferOutput<typeof MissionSaveDataSchema>;
export type ChatHistorySaveData = v.InferOutput<typeof ChatHistorySaveDataSchema>;
