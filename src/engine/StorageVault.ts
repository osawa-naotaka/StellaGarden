import { getStorageInitialValue, type StorageId, type StorageKey } from "../_registry/StorageRegistry";
import type { Pos2D } from "../lib/VoxelMap";
import * as v from "valibot";
import { ItemIdSchema } from "./ItemDefs";

// export type StorageBundle = Record<StorageKey, StorageItself>;
// export type StorageItself = Record<StorageKind, StorageSlot[]>;
// export type StorageSlot = null | { itemId: ItemId, count: number };

export const StorageIdSchema = ItemIdSchema;
export const StorageKindSchema = v.string();
export const StorageKeySchema = v.string();

export const StorageSlotSchema = v.nullable(v.object({
    itemId: ItemIdSchema,
    count: v.number(),
}));

export type StorageSlot = v.InferOutput<typeof StorageSlotSchema>;
export type StorageItself = v.InferOutput<typeof StorageItselfSchema>;

export const StorageItselfSchema = v.record(StorageKindSchema, v.array(StorageSlotSchema));

export const StorageBundleSchema = v.record(StorageKeySchema, StorageItselfSchema);

export const StorageVaultSaveDataSchema = v.record(StorageIdSchema, StorageBundleSchema);

export type StorageVaultSaveData = v.InferOutput<typeof StorageVaultSaveDataSchema>;


export class StorageVault {
    private _storages: Map<StorageId, StorageBundle> = new Map();
    
    public getStorageBundle(id: StorageId): StorageBundle {
        const r = this._storages.get(id);
        if (r === undefined) throw new Error(`Storage ${id} not found`);
        return r;
    }

    public createStorageBundle(id: StorageId): void {
        const initialValue = getStorageInitialValue(id);
        this._storages.set(id, new StorageBundle(initialValue));
    }

    public toSaveData(): StorageVaultSaveData {
        const result: StorageVaultSaveData = {};
        for (const [id, bundle] of this._storages) {
            result[id] = bundle.toSaveData();
        }
        return result;
    }

    public loadFromSaveData(data: StorageVaultSaveData): void {
        this._storages.clear();
        for (const [id, bundleData] of Object.entries(data)) {
            this.createStorageBundle(id);
            this._storages.get(id)!.loadFromSaveData(bundleData);
        }
    }
}

export class StorageBundle {
    private _storage: Record<StorageKey, StorageItself> = {};
    private initialValue: StorageItself;

    constructor(initialValue: StorageItself) {
        this.initialValue = initialValue;
    }

    public createStorage(pos: Pos2D): StorageItself {
        const _key = key(pos);
        const r = this._storage[_key];
        if (r !== undefined) throw new Error(`Storage at ${_key} exists`);
        this._storage[_key] = JSON.parse(JSON.stringify(this.initialValue));
        return this._storage[_key];
    }

    public getStorage(pos: Pos2D): StorageItself {
        const _key = key(pos);
        const r = this._storage[_key];
        if (r === undefined) throw new Error(`Storage at ${_key} not found`);
        return r;
    }

    public setStorage(pos: Pos2D, storage: StorageItself): void {
        const _key = key(pos);
        this._storage[_key] = storage;
    }

    public getStorageSlot(pos: Pos2D, kind: string, index: number): StorageSlot {
        const storage = this.getStorage(pos);
        return storage[kind][index];
    }

    public setStorageSlot(pos: Pos2D, kind: string, index: number, slot: StorageSlot): void {
        const storage = {
            ...this.getStorage(pos),
            [kind]: [
                ...this.getStorage(pos)[kind],
            ],
        };
        storage[kind][index] = slot;
        this.setStorage(pos, storage);
    }

    public toSaveData(): Record<StorageKey, StorageItself> {
        return this._storage;
    }

    public loadFromSaveData(data: Record<StorageKey, StorageItself>): void {
        this._storage = data;
    }
}


function key(pos: Pos2D): string {
    return `${pos.x},${pos.z}`;
}
