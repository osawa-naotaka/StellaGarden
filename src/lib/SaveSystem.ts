import { safeParse } from "valibot";
import { SaveDataSchema, SlotHeaderSchema } from "./SaveSchema";

export type {
    AutoProcessingStorageSaveData,
    ChestStorageSaveData,
    DailyProcessingStorageSaveData,
    ForgeStorageSaveData,
    GameTimeSaveData,
    InventorySaveData,
    ManualProcessingStorageSaveData,
    PlayerStateSaveData,
    ReputationSaveData,
    SaveData,
    VoxelMapSaveData,
    WarpGateStorageSaveData,
    WorkbenchStorageSaveData,
} from "./SaveSchema";

// ─── セーブスロット型 ──────────────────────────────────────────────────────────

export type SaveSlot = 1 | 2 | 3;

// ─── 定数 ────────────────────────────────────────────────────────────────────

const DB_NAME = "stella-garden";
const DB_VERSION = 1;
const STORE_NAME = "saveData";
const CURRENT_SAVE_VERSION = 9;
/** これより古いバージョンはマイグレーションパスがなく、ロード不可。 */
const MIN_SUPPORTED_VERSION = 6;

function slotKey(slot: SaveSlot): string {
    return `save_slot_${slot}`;
}

// ─── マイグレーション ─────────────────────────────────────────────────────────

type RawSave = Record<string, unknown>;

/**
 * バージョン N → N+1 の変換関数。添え字 N で管理する。
 * 新バージョンを追加するときは `migrations[現在のCURRENT_SAVE_VERSION]` に追記し、
 * CURRENT_SAVE_VERSION をインクリメントする。
 */
const migrations: Record<number, (data: RawSave) => RawSave> = {
    6: (data) => ({ ...data, seed: "" }), // v6 → v7: seed フィールドを追加
    // v7 → v8: 手動処理 / 日次処理ストレージを追加（既存施設は新仕様 UI 起動時に Storage が作成されるため空配列で OK）
    7: (data) => ({
        ...data,
        manualProcessingStorage: { facilities: [] },
        dailyProcessingStorage: { facilities: [] },
    }),
    // v8 → v9: 自動処理ストレージを追加。既存セーブにはまだ自動処理施設が無いため空配列で OK。
    8: (data) => ({
        ...data,
        autoProcessingStorage: { facilities: [] },
    }),
};

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

/** スロットの存在確認とセーブ日時を返す。タイトル画面での一覧表示用。 */
export async function getSlotInfo(slot: SaveSlot): Promise<{ exists: boolean; timestamp: number | null }> {
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
                    resolve({ exists: false, timestamp: null });
                    return;
                }
                const result = safeParse(SlotHeaderSchema, raw);
                if (!result.success) {
                    resolve({ exists: false, timestamp: null });
                    return;
                }
                resolve({ exists: true, timestamp: result.output.timestamp });
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
