import type { Direction8, ItemStack } from "../_boundary/interfaces";
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

export interface WarpGateStorageSaveData {
    slots: (ItemStack | null)[];
}

export interface ReputationSaveData {
    points: number;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────

const DB_NAME = "stella-garden";
const DB_VERSION = 1;
const STORE_NAME = "saveData";
const SAVE_KEY = "autosave";
const CURRENT_SAVE_VERSION = 4;

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
export async function saveGame(data: Omit<SaveData, "version" | "timestamp">): Promise<void> {
    const saveData: SaveData = {
        ...data,
        version: CURRENT_SAVE_VERSION,
        timestamp: Date.now(),
    };
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(saveData, SAVE_KEY);
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
export async function loadGame(): Promise<SaveData | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).get(SAVE_KEY);
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

/** セーブデータが存在するかを高速確認する。データ本体は読み込まない。 */
export async function hasSaveData(): Promise<boolean> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).count(SAVE_KEY);
            request.onsuccess = () => {
                db.close();
                resolve(request.result > 0);
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.warn("Failed to check save data:", e);
        return false;
    }
}

/** セーブデータを削除する。 */
export async function deleteGame(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(SAVE_KEY);
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
