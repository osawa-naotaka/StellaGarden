import { v6 as uuidv6 } from "uuid";
import { safeParse } from "valibot";
import { SaveDataSchema, SlotHeaderSchema } from "./SaveSchema";

export type {
    AutoProcessingStorageSaveData,
    DailyProcessingStorageSaveData,
    GameTimeSaveData,
    InventorySaveData,
    MissionSaveData,
    PlayerStateSaveData,
    ReputationSaveData,
    SaveData,
    VoxelMapSaveData,
} from "./SaveSchema";

// ─── セーブスロット型 ──────────────────────────────────────────────────────────

/**
 * セーブスロットID。文字列ベースの不透明な識別子。
 * 既存セーブとの互換のため "1", "2", "3" のような単純な ID も許容する。
 * 新規作成時は `newSlotId()` (UUIDv6) で生成する。
 */
export type SaveSlot = string;

/** 新しいセーブスロットID（UUIDv6）を発行する。タイムスタンプを含むため自然に時系列順になる。 */
export function newSlotId(): SaveSlot {
    return uuidv6();
}

/** スロット一覧表示用の項目。 */
export interface SlotEntry {
    slot: SaveSlot;
    timestamp: number;
    slotName: string;
}

// ─── 定数 ────────────────────────────────────────────────────────────────────

const DB_NAME = "stella-garden";
const DB_VERSION = 1;
const STORE_NAME = "saveData";
const CURRENT_SAVE_VERSION = 15;
/** これより古いバージョンはマイグレーションパスがなく、ロード不可。 */
const MIN_SUPPORTED_VERSION = 15;

const SLOT_KEY_PREFIX = "save_slot_";

function slotKey(slot: SaveSlot): string {
    return SLOT_KEY_PREFIX + slot;
}

function slotIdFromKey(key: unknown): SaveSlot | null {
    if (typeof key !== "string") return null;
    if (!key.startsWith(SLOT_KEY_PREFIX)) return null;
    return key.slice(SLOT_KEY_PREFIX.length);
}

// ─── マイグレーション ─────────────────────────────────────────────────────────

type RawSave = Record<string, unknown>;

/**
 * バージョン N → N+1 の変換関数。添え字 N で管理する。
 * 新バージョンを追加するときは `migrations[現在のCURRENT_SAVE_VERSION]` に追記し、
 * CURRENT_SAVE_VERSION をインクリメントする。
 *
 * 現在は MIN_SUPPORTED_VERSION === CURRENT_SAVE_VERSION のためマイグレーションパスは無い。
 * 将来バージョンを上げる際にここへ変換関数を追加する。
 */
const migrations: Record<number, (data: RawSave) => RawSave> = {};

/**
 * 任意のバージョンのセーブデータを現在のバージョンに移行し、スキーマで検証する。
 * マイグレーションパスが存在しない、またはスキーマ検証に失敗した場合は null を返す。
 */
function migrateAndParse(raw: RawSave): import("./SaveSchema").SaveData | null {
    let data = raw;
    for (let v = data.version as number; v < CURRENT_SAVE_VERSION; v++) {
        const fn = migrations[v];
        if (!fn) {
            console.warn(`No migration path from version ${v} to ${v + 1}.`);
            return null;
        }
        data = { ...fn(data), version: v + 1 };
    }
    const result = safeParse(SaveDataSchema, data);
    if (!result.success) {
        console.warn("Save data failed schema validation after migration:", result.issues);
        return null;
    }
    return result.output;
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
export async function saveGame(slot: SaveSlot, data: Omit<import("./SaveSchema").SaveData, "version" | "timestamp">): Promise<void> {
    const saveData = {
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

/** 指定スロットを削除する。 */
export async function deleteSlot(slot: SaveSlot): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(slotKey(slot));
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

/**
 * スロット名を変更する。version マイグレーションは行わず生 raw の slotName だけを書き換える。
 * 該当スロットが存在しない、または raw に slotName フィールドが追加できる構造でない場合は no-op。
 */
export async function renameSlot(slot: SaveSlot, newName: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(slotKey(slot));
        getReq.onsuccess = () => {
            const raw = getReq.result as RawSave | undefined;
            if (!raw) {
                resolve();
                return;
            }
            raw.slotName = newName;
            store.put(raw, slotKey(slot));
        };
        getReq.onerror = () => {
            db.close();
            reject(getReq.error);
        };
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

/**
 * スロットを複製する。dst が省略された場合は新しい UUIDv6 を発行する。
 * 生 raw のままコピーするため、マイグレーションは挟まない（容量・速度の観点）。
 * 複製後のスロットには " (コピー)" を付け、timestamp は現在時刻に更新する。
 * 戻り値は新しいスロットID。
 */
export async function duplicateSlot(src: SaveSlot, dst?: SaveSlot): Promise<SaveSlot> {
    const dstId = dst ?? newSlotId();
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(slotKey(src));
        let didPut = false;
        getReq.onsuccess = () => {
            const raw = getReq.result as RawSave | undefined;
            if (!raw) {
                resolve(dstId);
                return;
            }
            const srcName = typeof raw.slotName === "string" ? raw.slotName : "セーブデータ";
            const cloned: RawSave = { ...raw, slotName: `${srcName} (コピー)`, timestamp: Date.now() };
            store.put(cloned, slotKey(dstId));
            didPut = true;
        };
        getReq.onerror = () => {
            db.close();
            reject(getReq.error);
        };
        tx.oncomplete = () => {
            db.close();
            if (didPut) resolve(dstId);
            else resolve(dstId);
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

/**
 * 全セーブスロットを列挙する。timestamp 降順（新しい順）で返す。
 * 不正なバージョン / スキーマ不一致は無視する。
 */
export async function listSlots(): Promise<SlotEntry[]> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const keysReq = store.getAllKeys();
            const valuesReq = store.getAll();
            tx.oncomplete = () => {
                db.close();
                const keys = keysReq.result;
                const values = valuesReq.result as RawSave[];
                const entries: SlotEntry[] = [];
                for (let i = 0; i < keys.length; i++) {
                    const slot = slotIdFromKey(keys[i]);
                    if (slot === null) continue;
                    const raw = values[i];
                    const version = raw?.version as number | undefined;
                    if (!raw || version === undefined || version < MIN_SUPPORTED_VERSION || version > CURRENT_SAVE_VERSION) continue;
                    // 古いバージョンの raw には slotName が無いため、ヘッダ検証前に埋める
                    const rawForHeader: RawSave = typeof raw.slotName === "string" ? raw : { ...raw, slotName: "セーブデータ" };
                    const result = safeParse(SlotHeaderSchema, rawForHeader);
                    if (!result.success) continue;
                    entries.push({ slot, timestamp: result.output.timestamp, slotName: result.output.slotName });
                }
                entries.sort((a, b) => b.timestamp - a.timestamp);
                resolve(entries);
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        });
    } catch (e) {
        console.warn("Failed to list slots:", e);
        return [];
    }
}

/** IndexedDB からセーブデータを読み込む。必要に応じてマイグレーションを実行する。データがなければ null を返す。 */
export async function loadGame(slot: SaveSlot): Promise<import("./SaveSchema").SaveData | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).get(slotKey(slot));
            request.onsuccess = () => {
                db.close();
                const raw = request.result as RawSave | undefined;
                if (!raw) {
                    resolve(null);
                    return;
                }
                const version = raw.version as number | undefined;
                if (version === undefined || version < MIN_SUPPORTED_VERSION || version > CURRENT_SAVE_VERSION) {
                    console.warn(`Save data version ${version} is outside supported range. Starting new game.`);
                    resolve(null);
                    return;
                }
                if (version === CURRENT_SAVE_VERSION) {
                    const result = safeParse(SaveDataSchema, raw);
                    if (!result.success) {
                        console.warn("Save data failed schema validation:", result.issues);
                        resolve(null);
                        return;
                    }
                    resolve(result.output);
                    return;
                }
                const migrated = migrateAndParse(raw);
                if (migrated) {
                    console.info(`Save data migrated from version ${version} to ${CURRENT_SAVE_VERSION}.`);
                }
                resolve(migrated);
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

/** スロットの存在確認・セーブ日時・スロット名を返す。 */
export async function getSlotInfo(slot: SaveSlot): Promise<{ exists: boolean; timestamp: number | null; slotName: string | null }> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).get(slotKey(slot));
            request.onsuccess = () => {
                db.close();
                const raw = request.result as RawSave | undefined;
                const version = raw?.version as number | undefined;
                if (!raw || version === undefined || version < MIN_SUPPORTED_VERSION || version > CURRENT_SAVE_VERSION) {
                    resolve({ exists: false, timestamp: null, slotName: null });
                    return;
                }
                const rawForHeader: RawSave = typeof raw.slotName === "string" ? raw : { ...raw, slotName: "セーブデータ" };
                const result = safeParse(SlotHeaderSchema, rawForHeader);
                if (!result.success) {
                    resolve({ exists: false, timestamp: null, slotName: null });
                    return;
                }
                resolve({ exists: true, timestamp: result.output.timestamp, slotName: result.output.slotName });
            };
            request.onerror = () => {
                db.close();
                reject(request.error);
            };
        });
    } catch (e) {
        console.warn("Failed to get slot info:", e);
        return { exists: false, timestamp: null, slotName: null };
    }
}
