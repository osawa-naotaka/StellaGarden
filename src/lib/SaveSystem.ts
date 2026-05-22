import { v6 as uuidv6 } from "uuid";
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
const CURRENT_SAVE_VERSION = 13;
/** これより古いバージョンはマイグレーションパスがなく、ロード不可。 */
const MIN_SUPPORTED_VERSION = 6;

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
    // 加えて、facility_part ボクセルの Displacement X/Z を旧 findFacilityAnchor アルゴリズムで再構築する。
    // v8 まではアンカー探索が左上3タイル走査だったため Displacement が常に 0 で保存されていた。
    8: (data) => {
        fillFacilityPartDisplacementsV8(data);
        return {
            ...data,
            autoProcessingStorage: { facilities: [] },
        };
    },
    // v9 → v10: cartStorage を追加。既存セーブには台車がないため空で初期化。
    9: (data) => ({
        ...data,
        cartStorage: { nextId: 1, carts: [] },
    }),
    // v10 → v11: pipe → furrow_canal リネーム。
    // 全ストレージのアイテムスタックを走査して旧 itemId "pipe" を "furrow_canal" に置換する。
    10: (data) => {
        renamePipeToFurrowCanal(data);
        return data;
    },
    // v11 → v12: 手動処理 / 日次処理ストレージのスロットに `selectedRecipeIndex: 0` を追加。
    // 金床に「刃 / 扱き歯」の選択ドロップダウンを導入したため、既存セーブの slots に該当フィールドが無い。
    // 既存スロットは全て初期値 0（最初に登録されたレシピ＝刃）として扱う。
    11: (data) => {
        addSelectedRecipeIndexV11(data);
        return data;
    },
    // v12 → v13: 任意数セーブスロット対応のため slotName を追加。
    // マイグレーション時点ではスロットIDから命名できないため、一律 "セーブデータ" とする。
    // ユーザーはタイトル画面のスロット選択画面からリネーム可能。
    12: (data) => ({ ...data, slotName: "セーブデータ" }),
};

/**
 * v11 セーブの manualProcessingStorage / dailyProcessingStorage 内の全スロットに
 * `selectedRecipeIndex: 0` を補完する。v11→v12 マイグレーション用。
 */
function addSelectedRecipeIndexV11(data: RawSave): void {
    for (const key of ["manualProcessingStorage", "dailyProcessingStorage"] as const) {
        const ps = data[key] as { facilities?: { slots?: { selectedRecipeIndex?: number } }[] } | undefined;
        if (!ps?.facilities) continue;
        for (const f of ps.facilities) {
            if (f.slots && f.slots.selectedRecipeIndex === undefined) {
                f.slots.selectedRecipeIndex = 0;
            }
        }
    }
}

/**
 * セーブデータ中のアイテムスタックに登場する旧 itemId "pipe" をすべて "furrow_canal" に置換する。
 * v10 → v11 マイグレーションで使用。
 *
 * 走査対象:
 *   - inventory (toolbar / inventory)
 *   - chestStorage
 *   - forgeStorage (ingredient / fuel / output)
 *   - workbenchStorage (tool)
 *   - warpGateStorage
 *   - manualProcessingStorage / dailyProcessingStorage (input / outputs)
 *   - autoProcessingStorage (inputs / outputs)
 *   - cartStorage (inventorySlots / attachmentSlot)
 *   - reputation.cumulativeShipped (タプル [itemId, count])
 */
function renamePipeToFurrowCanal(data: RawSave): void {
    type Stack = { itemId: string; count: number };
    const rename = (s: Stack | null | undefined): Stack | null => {
        if (!s) return s ?? null;
        return s.itemId === "pipe" ? { ...s, itemId: "furrow_canal" } : s;
    };
    const renameArr = (arr: (Stack | null)[] | undefined): (Stack | null)[] => (Array.isArray(arr) ? arr.map(rename) : []);

    const inv = data.inventory as { toolbarSlots?: (Stack | null)[]; inventorySlots?: (Stack | null)[] } | undefined;
    if (inv) {
        inv.toolbarSlots = renameArr(inv.toolbarSlots);
        inv.inventorySlots = renameArr(inv.inventorySlots);
    }

    const cs = data.chestStorage as { chests?: { slots?: (Stack | null)[] }[] } | undefined;
    if (cs?.chests) for (const c of cs.chests) c.slots = renameArr(c.slots);

    const fs = data.forgeStorage as { forges?: { slots?: { ingredient?: Stack | null; fuel?: Stack | null; output?: Stack | null } }[] } | undefined;
    if (fs?.forges)
        for (const f of fs.forges) {
            if (f.slots) {
                f.slots.ingredient = rename(f.slots.ingredient);
                f.slots.fuel = rename(f.slots.fuel);
                f.slots.output = rename(f.slots.output);
            }
        }

    const ws = data.workbenchStorage as { workbenches?: { slots?: { tool?: Stack | null } }[] } | undefined;
    if (ws?.workbenches)
        for (const w of ws.workbenches) {
            if (w.slots) w.slots.tool = rename(w.slots.tool);
        }

    const wg = data.warpGateStorage as { slots?: (Stack | null)[] } | undefined;
    if (wg) wg.slots = renameArr(wg.slots);

    for (const key of ["manualProcessingStorage", "dailyProcessingStorage"] as const) {
        const ps = data[key] as { facilities?: { slots?: { input?: Stack | null; outputs?: (Stack | null)[] } }[] } | undefined;
        if (ps?.facilities)
            for (const f of ps.facilities) {
                if (f.slots) {
                    f.slots.input = rename(f.slots.input);
                    f.slots.outputs = renameArr(f.slots.outputs);
                }
            }
    }

    const aps = data.autoProcessingStorage as { facilities?: { slots?: { inputs?: (Stack | null)[]; outputs?: (Stack | null)[] } }[] } | undefined;
    if (aps?.facilities)
        for (const f of aps.facilities) {
            if (f.slots) {
                f.slots.inputs = renameArr(f.slots.inputs);
                f.slots.outputs = renameArr(f.slots.outputs);
            }
        }

    const carts = data.cartStorage as { carts?: { inventorySlots?: (Stack | null)[]; attachmentSlot?: Stack | null }[] } | undefined;
    if (carts?.carts)
        for (const c of carts.carts) {
            c.inventorySlots = renameArr(c.inventorySlots);
            c.attachmentSlot = rename(c.attachmentSlot);
        }

    const rep = data.reputation as { cumulativeShipped?: [string, number][] } | undefined;
    if (rep?.cumulativeShipped) {
        rep.cumulativeShipped = rep.cumulativeShipped.map(([id, cnt]) => (id === "pipe" ? ["furrow_canal", cnt] : [id, cnt]));
    }
}

/**
 * v8 セーブの voxels を走査し、facility_part の Displacement X/Z を埋める。
 * 旧 findFacilityAnchor の挙動（左上方向 3 タイル走査）を再現してアンカーを発見し、
 * アンカーからの相対座標 (dx, dz) を bit 30-32 / 33-35 に書き込む。
 *
 * voxel ビットレイアウト（engine/VoxelDefs.ts 参照）:
 *   bits  0- 7: terrain type
 *   bits  8-15: entity type    (facility_part = 7)
 *   bits 30-32: displacement X
 *   bits 33-35: displacement Z
 */
function fillFacilityPartDisplacementsV8(data: RawSave): void {
    const vm = data.voxelMap as { width: number; height: number; depth: number; voxels: unknown } | undefined;
    if (!vm) return;
    const { width, height, depth } = vm;
    if (typeof width !== "number" || typeof height !== "number" || typeof depth !== "number") return;
    if (!(vm.voxels instanceof BigUint64Array)) return;
    const voxels = vm.voxels;

    const FACILITY_PART = 7; // ENTITY_TYPES.facility_part

    const idx = (x: number, y: number, z: number): number => x + y * width * depth + z * width;
    const surfaceY = (x: number, z: number): number => {
        for (let y = height - 1; y >= 0; y--) {
            if (voxels[idx(x, y, z)] !== 0n) return y;
        }
        return -1;
    };
    const entityTypeOf = (v: bigint): number => Number((v >> 8n) & 0xffn);

    for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
            const y = surfaceY(x, z);
            if (y < 0) continue;
            const v = voxels[idx(x, y, z)];
            if (entityTypeOf(v) !== FACILITY_PART) continue;

            let found = false;
            for (let dz = 0; dz <= 2 && !found; dz++) {
                for (let dx = 0; dx <= 2 && !found; dx++) {
                    if (dx === 0 && dz === 0) continue;
                    const nx = x - dx;
                    const nz = z - dz;
                    if (nx < 0 || nz < 0) continue;
                    const ny = surfaceY(nx, nz);
                    if (ny < 0) continue;
                    const et = entityTypeOf(voxels[idx(nx, ny, nz)]);
                    if (et === 0 || et === FACILITY_PART) continue;

                    let nv = v & ~(0x7n << 30n) & ~(0x7n << 33n);
                    nv |= (BigInt(dx) & 0x7n) << 30n;
                    nv |= (BigInt(dz) & 0x7n) << 33n;
                    voxels[idx(x, y, z)] = nv;
                    found = true;
                }
            }
            if (!found) console.warn(`v8→v9 migration: facility_part at (${x}, ${z}) — anchor not found.`);
        }
    }
}

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
