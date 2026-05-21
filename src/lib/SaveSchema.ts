import * as v from "valibot";
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

export const ChestStorageSaveDataSchema = v.object({
    chests: v.array(
        v.object({
            key: v.string(),
            slots: v.array(NullableItemStackSchema),
        }),
    ),
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

export const WorkbenchStorageSaveDataSchema = v.object({
    workbenches: v.array(
        v.object({
            key: v.string(),
            slots: v.object({
                tool: NullableItemStackSchema,
            }),
        }),
    ),
});

export const WarpGateStorageSaveDataSchema = v.object({
    slots: v.array(NullableItemStackSchema),
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

export const ManualProcessingStorageSaveDataSchema = v.object({
    facilities: v.array(
        v.object({
            key: v.string(),
            slots: ProcessingSlotsSchema,
        }),
    ),
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

// ─── ルートスキーマ ───────────────────────────────────────────────────────────

export const SaveDataSchema = v.object({
    version: v.number(),
    timestamp: v.number(),
    seed: v.string(),
    voxelMap: VoxelMapSaveDataSchema,
    playerState: PlayerStateSaveDataSchema,
    inventory: InventorySaveDataSchema,
    gameTime: GameTimeSaveDataSchema,
    chestStorage: ChestStorageSaveDataSchema,
    forgeStorage: ForgeStorageSaveDataSchema,
    workbenchStorage: WorkbenchStorageSaveDataSchema,
    warpGateStorage: WarpGateStorageSaveDataSchema,
    manualProcessingStorage: ManualProcessingStorageSaveDataSchema,
    dailyProcessingStorage: DailyProcessingStorageSaveDataSchema,
    autoProcessingStorage: AutoProcessingStorageSaveDataSchema,
    cartStorage: CartStorageSaveDataSchema,
    reputation: ReputationSaveDataSchema,
});

/** スロット一覧表示用の軽量ヘッダースキーマ。 */
export const SlotHeaderSchema = v.object({
    version: v.number(),
    timestamp: v.number(),
});

// ─── 派生型エクスポート ───────────────────────────────────────────────────────

export type SaveData = v.InferOutput<typeof SaveDataSchema>;
export type VoxelMapSaveData = v.InferOutput<typeof VoxelMapSaveDataSchema>;
export type PlayerStateSaveData = v.InferOutput<typeof PlayerStateSaveDataSchema>;
export type InventorySaveData = v.InferOutput<typeof InventorySaveDataSchema>;
export type GameTimeSaveData = v.InferOutput<typeof GameTimeSaveDataSchema>;
export type ChestStorageSaveData = v.InferOutput<typeof ChestStorageSaveDataSchema>;
export type ForgeStorageSaveData = v.InferOutput<typeof ForgeStorageSaveDataSchema>;
export type WorkbenchStorageSaveData = v.InferOutput<typeof WorkbenchStorageSaveDataSchema>;
export type WarpGateStorageSaveData = v.InferOutput<typeof WarpGateStorageSaveDataSchema>;
export type ManualProcessingStorageSaveData = v.InferOutput<typeof ManualProcessingStorageSaveDataSchema>;
export type DailyProcessingStorageSaveData = v.InferOutput<typeof DailyProcessingStorageSaveDataSchema>;
export type AutoProcessingStorageSaveData = v.InferOutput<typeof AutoProcessingStorageSaveDataSchema>;
export type CartStorageSaveData = v.InferOutput<typeof CartStorageSaveDataSchema>;
export type ReputationSaveData = v.InferOutput<typeof ReputationSaveDataSchema>;
