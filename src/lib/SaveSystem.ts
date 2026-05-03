import type { Direction8, ItemId, ItemStack } from "../_boundary/interfaces";
import type { Pos2D } from "./VoxelMap";

// ─── セーブデータ型定義 ──────────────────────────────────────────────────────

export interface SaveData {
    version: number;
    timestamp: number;
    voxelMap: VoxelMapSaveData;
    playerState: PlayerStateSaveData;
    inventory: InventorySaveData;
    gameTime: GameTimeSaveData;
    chestStorage: ChestStorageSaveData;
    forgeStorage: ForgeStorageSaveData;
    workbenchStorage: WorkbenchStorageSaveData;
    warpGateStorage: WarpGateStorageSaveData;
    reputation: ReputationSaveData;
}

export interface VoxelMapSaveData {
    width: number;
    height: number;
    depth: number;
    horizonHeight: number;
    voxels: BigUint64Array;
    riversideCells: Uint32Array;
}

export interface PlayerStateSaveData {
    posInWorld: Pos2D;
    zoomLevel: number;
    facing: Direction8;
}

export interface InventorySaveData {
    toolbarSlots: (ItemStack | null)[];
    inventorySlots: (ItemStack | null)[];
    selectedIndex: number;
}

export interface GameTimeSaveData {
    elapsedMs: number;
}

export interface ChestStorageSaveData {
    chests: Array<{ key: string; slots: (ItemStack | null)[] }>;
}

export interface ForgeStorageSaveData {
    forges: Array<{
        key: string;
        slots: {
            ingredient: ItemStack | null;
            fuel: ItemStack | null;
            output: ItemStack | null;
        };
    }>;
}

export interface WorkbenchStorageSaveData {
    workbenches: Array<{
        key: string;
        slots: {
            tool: ItemStack | null;
        };
    }>;
}

export interface WarpGateStorageSaveData {
    slots: (ItemStack | null)[];
}

export interface ReputationSaveData {
    points: number;
    /** 品目ごとの累計出荷数。Tier アンロック判定に使う。 */
    cumulativeShipped: Array<[ItemId, number]>;
}

// ─── セーブスロット型 ──────────────────────────────────────────────────────────

export type SaveSlot = 1 | 2 | 3;

// ─── 定数 ────────────────────────────────────────────────────────────────────

const DB_NAME = "stella-garden";
const DB_VERSION = 1;
const STORE_NAME = "saveData";
const CURRENT_SAVE_VERSION = 6;

function slotKey(slot: SaveSlot): string {
    return `save_slot_${slot}`;
}

// ─── IndexedDB ユーティリティ ────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ─── 公開 API ────────────────────────────────────────────────────────────────

/** ゲーム状態を IndexedDB に保存する。 */
export async function saveGame(slot: SaveSlot, data: Omit<SaveData, "version" | "timestamp">): Promise<void> {
    const saveData: SaveData = {
        ...data,
        version: CURRENT_SAVE_VERSION,
        timestamp: Date.now(),
    };
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(saveData, slotKey(slot));
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

/** IndexedDB からセーブデータを読み込む。データがなければ null を返す。 */
export async function loadGame(slot: SaveSlot): Promise<SaveData | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).get(slotKey(slot));
            request.onsuccess = () => {
                db.close();
                const data = request.result as SaveData | undefined;
                if (!data) {
                    resolve(null);
                    return;
                }
                if (data.version !== CURRENT_SAVE_VERSION) {
                    console.warn(`Save data version mismatch: expected ${CURRENT_SAVE_VERSION}, got ${data.version}. Starting new game.`);
                    resolve(null);
                    return;
                }
                resolve(data);
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.warn("Failed to load save data:", e);
        return null;
    }
}

/** スロットの存在確認とセーブ日時を返す。タイトル画面での一覧表示用。 */
export async function getSlotInfo(slot: SaveSlot): Promise<{ exists: boolean; timestamp: number | null }> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).get(slotKey(slot));
            request.onsuccess = () => {
                db.close();
                const data = request.result as SaveData | undefined;
                if (!data || data.version !== CURRENT_SAVE_VERSION) {
                    resolve({ exists: false, timestamp: null });
                    return;
                }
                resolve({ exists: true, timestamp: data.timestamp });
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.warn("Failed to get slot info:", e);
        return { exists: false, timestamp: null };
    }
}
