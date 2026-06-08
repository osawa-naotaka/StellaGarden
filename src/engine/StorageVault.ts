import * as v from "valibot";
import type { IVoxelWriter } from "../_boundary/interfaces";
import type { StorageId } from "../_registry/StorageRegistry";
import { ItemIdSchema } from "./ItemDefs";
import type { KeyedSlotStorage } from "./KeyedSlotStorage";

// ---------------------------------------------------------------------------
// セーブスキーマ
//
// 現状 StorageVault に載るのは SlotStorage（NamedSlots = Record<kind, slot[]>）のみ。
// KeyedSlotStorage.toSaveData() の Array<{ key, slots }> 形に対応する。
// 将来 NamedSlots 以外の slots 形を載せる場合はここを拡張する。
// ---------------------------------------------------------------------------

export const StorageSlotSchema = v.nullable(
    v.object({
        itemId: ItemIdSchema,
        count: v.number(),
    }),
);

const NamedSlotsSaveSchema = v.record(v.string(), v.array(StorageSlotSchema));
const KeyedEntrySaveSchema = v.object({ key: v.string(), slots: NamedSlotsSaveSchema });
export const StorageVaultSaveDataSchema = v.record(v.string(), v.array(KeyedEntrySaveSchema));
export type StorageVaultSaveData = v.InferOutput<typeof StorageVaultSaveDataSchema>;

// ---------------------------------------------------------------------------
// 定義レジストリ（静的・モジュールグローバル）
//
// 各エンティティ定義ファイル（_registry/entities/Chest.ts 等）が読み込み時に
// registerStorageFactory() でファクトリを登録する。実行時状態は持たない。
// ---------------------------------------------------------------------------

export type StorageFactory = () => KeyedSlotStorage<unknown>;

const storageFactories = new Map<StorageId, StorageFactory>();

export function registerStorageFactory(id: StorageId, factory: StorageFactory): void {
    storageFactories.set(id, factory);
}

export function getStorageFactories(): ReadonlyMap<StorageId, StorageFactory> {
    return storageFactories;
}

// ---------------------------------------------------------------------------
// 実行時インスタンスの集約コンテナ（エンジンが持つ唯一の収納フィールド）
// ---------------------------------------------------------------------------

export class StorageVault {
    private storages = new Map<StorageId, KeyedSlotStorage<unknown>>();

    /** 登録済みファクトリを全て生成して保持する（boot 時に1回呼ぶ）。 */
    init(factories: ReadonlyMap<StorageId, StorageFactory> = storageFactories): void {
        for (const [id, factory] of factories) this.storages.set(id, factory());
    }

    /** 指定 id のストレージを具体型として取り出す。境界での明示ダウンキャスト1箇所。 */
    get<T extends KeyedSlotStorage<unknown>>(id: StorageId): T {
        const s = this.storages.get(id);
        if (s === undefined) throw new Error(`Storage ${id} not found`);
        return s as T;
    }

    onDailyTick(voxelMap: IVoxelWriter): void {
        for (const s of this.storages.values()) s.onDailyTick(voxelMap);
    }

    toSaveData(): StorageVaultSaveData {
        const result: StorageVaultSaveData = {};
        for (const [id, s] of this.storages) result[id] = s.toSaveData() as StorageVaultSaveData[string];
        return result;
    }

    loadSaveData(data: StorageVaultSaveData): void {
        for (const [id, s] of this.storages) {
            const entries = data[id];
            if (entries) s.loadSaveData(entries);
        }
    }
}
