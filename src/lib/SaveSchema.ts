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

const Direction8Schema = v.picklist([
    "down", "up", "left", "right",
    "down_left", "down_right", "up_left", "up_right",
]);

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
export type ReputationSaveData = v.InferOutput<typeof ReputationSaveDataSchema>;
