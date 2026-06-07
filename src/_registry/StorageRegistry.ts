import * as v from "valibot";
import type { ItemId, ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { ItemIdSchema } from "../engine/ItemDefs";
import { getItemDef } from "./ItemRegistry";

export const StorageIdSchema = ItemIdSchema;
export const StorageKindSchema = v.string();
export const StorageKeySchema = v.string();

export type StorageId = v.InferOutput<typeof StorageIdSchema>;
export type StorageKind = v.InferOutput<typeof StorageKindSchema>;
export type StorageKey = v.InferOutput<typeof StorageKeySchema>;

export const StorageSlotsSchema = v.array(v.nullable(v.object({
    itemId: StorageIdSchema,
    count: v.number(),
})));
export const StorageSetSchema = v.record(StorageKindSchema, StorageSlotsSchema);
export const StorageValueSchema = v.record(StorageKeySchema, StorageSetSchema);
export const StorageSchema = v.object({
    value: StorageValueSchema,
    initialValue: StorageSetSchema,
});

export type StorageSlots = v.InferOutput<typeof StorageSlotsSchema>;
export type StorageSet = v.InferOutput<typeof StorageSetSchema>;
export type StorageValue = v.InferOutput<typeof StorageValueSchema>;

export type Storage = v.InferOutput<typeof StorageSchema>;

export const StoragesSchema = v.record(StorageIdSchema, StorageSchema);
export type Storages = v.InferOutput<typeof StoragesSchema>;

type OnDailyTick = (voxelMap: IVoxelWriter) => void;

type CanAccept = (kind: string, index: number, itemStack: ItemStack | null) => boolean;

let storages: Storages = {};
const onDailyTicks: Array<OnDailyTick> = [];

const canAccepts = new Map<ItemId, CanAccept>();

function key(pos: Pos2D): string {
    return `${pos.x},${pos.z}`;
}

export function registerStorage(storageId: StorageId, initialValue: StorageSet, onDailyTick?: OnDailyTick, canAccept?: CanAccept): void {
    storages[storageId] = { value: {}, initialValue };
    if (onDailyTick) onDailyTicks.push(onDailyTick);
    if (canAccept) canAccepts.set(storageId, canAccept);
}

export function onDailyTickStorage(voxelMap: IVoxelWriter): void {
    for (const v of onDailyTicks) {
        v(voxelMap);
    }
}

export function createStorage(storageId: StorageId, pos: Pos2D): void {
    const storage = get(storageId);
    const value = storage.value[(key(pos))];
    if (value !== undefined) throw new Error(`Storage ${storageId} already exists at ${pos.x},${pos.z}`);
    storage.value[key(pos)] = JSON.parse(JSON.stringify(storage.initialValue));
}

export function getStorage(storageId: StorageId): Storage {
    return get(storageId);
}

export function getStorageSet(storageId: StorageId, pos: Pos2D | null): StorageSet | undefined {
    if (pos === null) return undefined;
    const storage = get(storageId);
    return storage.value[key(pos)];
}

export function getStorageSlot(storageId: StorageId, pos: Pos2D, kind: StorageKind, index: number): ItemStack | null {
    const storageSet = getStorageSet(storageId, pos)
    if (storageSet === undefined) return null;
    const storage = storageSet[kind];
    if (storage === undefined) throw new Error(`Storage kind ${kind} not found`);
    return storage[index];
}

export function getStorageNumberValue(storageId: StorageId, pos: Pos2D, kind: StorageKind): number | null {
    const itemStack = getStorageSlot(storageId, pos, kind, 0);
    return itemStack ? itemStack.count : null;
}

export function setStorageSlot(storageId: StorageId, pos: Pos2D, kind: StorageKind, index: number, itemStack: ItemStack | null): void {
    const storage = get(storageId);
    const storageSet = storage.value[key(pos)];
    if (storageSet === undefined) throw new Error(`Storage not found at ${pos.x},${pos.z}`);
    if (!storageSet[kind]) throw new Error(`Storage kind ${kind} not found`);
    const newStorageSet = {
        ...storageSet
    };
    newStorageSet[kind][index] = itemStack;
    storage.value[key(pos)] = newStorageSet;
}

export function addToStorage(storageId: StorageId, pos: Pos2D, kind: StorageKind, itemStack: ItemStack | null): number {
    if (itemStack === null) return 0;
    const canAccept = canAccepts.get(storageId);

    const maxStack = getItemDef(itemStack.itemId)?.maxStack ?? 1;
    
    const storage = get(storageId);
    const storageSet = storage.value[key(pos)];
    if (storageSet === undefined) throw new Error(`Storage not found at ${pos.x},${pos.z}`);
    if (!storageSet[kind]) throw new Error(`Storage kind ${kind} not found`);

    const slots = [];
    let acc = 0;

    for (let i = 0; i < storageSet[kind].length; i++) {
        if (canAccept && !canAccept(kind, i, itemStack)) continue;
        const slot = storageSet[kind][i];
        if (slot === null) {
            if (acc !== itemStack.count) {
                slots[i] = itemStack;
                acc += itemStack.count;
            }
            continue; 
        }
        if (slot.itemId === itemStack.itemId) {
            slots[i] = {
                itemId: slot.itemId,
                count: Math.min(slot.count + (itemStack.count - acc), maxStack),
            };
            acc += slots[i]?.count ?? 0 - slot.count;
        } else {
            slots[i] = slot;
        }
    }

    return acc;
}

export function setStorageNumberValue(storageId: StorageId, pos: Pos2D, kind: StorageKind, value: number): void {
    const itemStack = storageNumberValueOf(value);
    setStorageSlot(storageId, pos, kind, 0, itemStack)
}

export function storageNumberValueOf(value: number): ItemStack {
    const itemStack: ItemStack = {
        itemId: "none",
        count: value,
    };
    return itemStack;
}


export function removeStorage(storageId: StorageId, pos: Pos2D): void {
    const storage = get(storageId);
    delete storage.value[key(pos)];
}

export function collectAllStacks(storageId: StorageId, pos: Pos2D, kind?: StorageKind): ItemStack[] {
    const storage = get(storageId);
    const storageSet = storage.value[key(pos)];
    if (!storageSet) return [];
    const allSlots: ItemStack[] = [];
    for (const slots of kind ? [storageSet[kind]] : Object.values(storageSet)) {
        allSlots.push(...slots.filter((x) => x !== null));
    }
    return allSlots;
}

export function loadStorages(saveStorages: Storages): void {
    storages = JSON.parse(JSON.stringify(saveStorages));
}

export function getStorages(): Storages {
    return storages;
}

export function posFromStorageKey(key: string): Pos2D {
    const [x, z] = key.split(",").map(Number);
    return { x, z };
}

function get(storageId: StorageId): Storage {
    const storage = storages[storageId];
    if (storage === undefined) throw new Error(`Storage ${storageId} not found`);
    return storage;
}
