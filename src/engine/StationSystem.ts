import type { ICartWriter, IEventBroker, ItemStack, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { findFacilityAnchor } from "../_registry/facilityUtil";
import { getItemDef } from "../_registry/ItemRegistry";
import type { AutoProcessingStorage } from "./AutoProcessingStorage";
import type { ChestStorage } from "./ChestStorage";
import type { DailyProcessingStorage } from "./DailyProcessingStorage";
import { AUTO_PROCESSING_DEFS, DAILY_PROCESSING_DEFS } from "./ProcessingRecipes";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getVariantFromVoxel } from "./VoxelDefs";

// ---------------------------------------------------------------------------
// 向きエンコード
// ---------------------------------------------------------------------------

/**
 * variant 値と方向文字列の対応。
 * variant 0="up", 1="down", 2="left", 3="right"
 * フォーク休止辺（= ステーションの向き）を表す。
 */
export const STATION_VARIANT_TO_SIDE = ["up", "down", "left", "right"] as const;

export type StationSide = "up" | "down" | "left" | "right";

/** ステーションのフォーク休止辺（向き）を voxel から取得する。範囲外は "up"。 */
export function getStationRestSide(voxel: bigint): StationSide {
    const variant = getVariantFromVoxel(voxel);
    return STATION_VARIANT_TO_SIDE[variant] ?? "up";
}

// ---------------------------------------------------------------------------
// 方向ベクトル変換
// ---------------------------------------------------------------------------

type Vec2 = { dx: number; dz: number };

function sideToVec(side: StationSide): Vec2 {
    switch (side) {
        case "up":    return { dx: 0, dz: -1 };
        case "down":  return { dx: 0, dz:  1 };
        case "left":  return { dx: -1, dz: 0 };
        case "right": return { dx:  1, dz: 0 };
    }
}

/** 2つの方向ベクトルが平行（同じか逆向き）かどうか判定する。 */
function isParallel(a: Vec2, b: Vec2): boolean {
    // 内積の絶対値が1（正規化済み整数ベクトルが同軸）
    return Math.abs(a.dx * b.dx + a.dz * b.dz) === 1;
}

// ---------------------------------------------------------------------------
// ストレージ注入
// ---------------------------------------------------------------------------

let chestStorageRef: ChestStorage | null = null;
let dailyStorageRef: DailyProcessingStorage | null = null;
let autoStorageRef: AutoProcessingStorage | null = null;

/**
 * App.tsx から各ストレージを注入する。
 * Chest.ts の setChestStorage と同じパターン。
 */
export function setStationStorages(
    chest: ChestStorage,
    daily: DailyProcessingStorage,
    auto: AutoProcessingStorage,
): void {
    chestStorageRef = chest;
    dailyStorageRef = daily;
    autoStorageRef = auto;
}

// ---------------------------------------------------------------------------
// カートへのアイテム追加ヘルパー（CartActionSystem を結合しない自前実装）
// ---------------------------------------------------------------------------

/**
 * カートの inventorySlots にアイテムを可能な限り追加する（非アトミック）。
 * 既存スタックに積む → 空きスロットに新規作成の順。
 * 実際に追加した個数を返す。
 */
function addItemToCart(cart: ICartWriter, itemId: string, count: number): number {
    const maxStack = getItemDef(itemId)?.maxStack ?? 64;
    let remaining = count;

    // Phase 1: 既存の同 itemId スタックに積む
    for (let i = 0; i < cart.inventorySlots.length && remaining > 0; i++) {
        const slot = cart.inventorySlots[i];
        if (slot === null || slot.itemId !== itemId) continue;
        if (slot.count >= maxStack) continue;
        const space = maxStack - slot.count;
        const add = Math.min(space, remaining);
        cart.setInventorySlot(i, { itemId: slot.itemId, count: slot.count + add });
        remaining -= add;
    }

    // Phase 2: 空きスロットに新規作成
    for (let i = 0; i < cart.inventorySlots.length && remaining > 0; i++) {
        if (cart.inventorySlots[i] !== null) continue;
        const add = Math.min(maxStack, remaining);
        cart.setInventorySlot(i, { itemId: itemId as never, count: add });
        remaining -= add;
    }

    return count - remaining;
}

// ---------------------------------------------------------------------------
// アンローダー: カート → 施設入力
// ---------------------------------------------------------------------------

function unloadCartToChest(
    cart: ICartWriter,
    anchorPos: Pos2D,
    chest: ChestStorage,
): boolean {
    let moved = false;
    for (let i = 0; i < cart.inventorySlots.length; i++) {
        const slot = cart.inventorySlots[i];
        if (slot === null) continue;
        const itemId = slot.itemId;
        const maxStack = getItemDef(itemId)?.maxStack ?? 64;
        let remaining = slot.count;

        // 既存スタックに積む
        for (let j = 0; j < 64 && remaining > 0; j++) {
            const chestSlot = chest.getSlot(anchorPos, j);
            if (chestSlot === null || chestSlot.itemId !== itemId) continue;
            if (chestSlot.count >= maxStack) continue;
            const space = maxStack - chestSlot.count;
            const add = Math.min(space, remaining);
            chest.setSlot(anchorPos, j, { itemId: chestSlot.itemId, count: chestSlot.count + add });
            remaining -= add;
            moved = true;
        }
        // 空きスロットに新規
        for (let j = 0; j < 64 && remaining > 0; j++) {
            if (chest.getSlot(anchorPos, j) !== null) continue;
            const add = Math.min(maxStack, remaining);
            chest.setSlot(anchorPos, j, { itemId: itemId as never, count: add });
            remaining -= add;
            moved = true;
        }

        const transferred = slot.count - remaining;
        if (transferred > 0) {
            const newCount = slot.count - transferred;
            cart.setInventorySlot(i, newCount > 0 ? { itemId: slot.itemId, count: newCount } : null);
        }
    }
    return moved;
}

function unloadCartToAuto(
    cart: ICartWriter,
    anchorPos: Pos2D,
    autoStorage: AutoProcessingStorage,
    voxelMap: IVoxelWriter,
): boolean {
    let moved = false;
    for (let i = 0; i < cart.inventorySlots.length; i++) {
        const slot = cart.inventorySlots[i];
        if (slot === null) continue;
        if (!autoStorage.canAcceptInput(anchorPos, slot.itemId, voxelMap)) continue;

        const inputs = autoStorage.getInputs(anchorPos);
        const itemId = slot.itemId;
        const maxStack = getItemDef(itemId)?.maxStack ?? 64;
        let remaining = slot.count;

        // 既存スタックに積む
        for (let j = 0; j < inputs.length && remaining > 0; j++) {
            const inputSlot = inputs[j];
            if (inputSlot === null || inputSlot.itemId !== itemId) continue;
            if (inputSlot.count >= maxStack) continue;
            const space = maxStack - inputSlot.count;
            const add = Math.min(space, remaining);
            autoStorage.setInput(anchorPos, j, { itemId: inputSlot.itemId, count: inputSlot.count + add }, voxelMap);
            remaining -= add;
            moved = true;
        }
        // 空きスロットに新規
        for (let j = 0; j < inputs.length && remaining > 0; j++) {
            if (inputs[j] !== null) continue;
            const add = Math.min(maxStack, remaining);
            autoStorage.setInput(anchorPos, j, { itemId: itemId as never, count: add }, voxelMap);
            remaining -= add;
            moved = true;
        }

        const transferred = slot.count - remaining;
        if (transferred > 0) {
            const newCount = slot.count - transferred;
            cart.setInventorySlot(i, newCount > 0 ? { itemId: slot.itemId, count: newCount } : null);
        }
    }
    return moved;
}

function unloadCartToDaily(
    cart: ICartWriter,
    anchorPos: Pos2D,
    dailyStorage: DailyProcessingStorage,
    voxelMap: IVoxelWriter,
): boolean {
    let moved = false;
    const currentInput = dailyStorage.getInput(anchorPos);

    for (let i = 0; i < cart.inventorySlots.length; i++) {
        const slot = cart.inventorySlots[i];
        if (slot === null) continue;
        if (!dailyStorage.canAcceptInput(anchorPos, slot.itemId, voxelMap)) continue;

        // 空の場合: カート内の受理可能アイテムを投入
        // 既に入力中の場合: itemId が一致するものだけを追加
        if (currentInput !== null && currentInput.itemId !== slot.itemId) continue;

        const itemId = slot.itemId;
        const maxStack = getItemDef(itemId)?.maxStack ?? 64;
        const existingCount = currentInput?.itemId === itemId ? (currentInput?.count ?? 0) : 0;
        const space = maxStack - existingCount;
        if (space <= 0) continue;

        const add = Math.min(space, slot.count);
        const newInputStack: ItemStack = { itemId: itemId as never, count: existingCount + add };
        // setInput は内部で daysElapsed をリセットするため最終的なマージ済み stack を渡す
        dailyStorage.setInput(anchorPos, newInputStack, voxelMap);

        const newCartCount = slot.count - add;
        cart.setInventorySlot(i, newCartCount > 0 ? { itemId: slot.itemId, count: newCartCount } : null);
        moved = true;
        // daily は入力単一スロットなので1種類だけ投入して終了
        break;
    }
    return moved;
}

// ---------------------------------------------------------------------------
// ローダー: 施設出力 → カート
// ---------------------------------------------------------------------------

function loadChestToCart(
    cart: ICartWriter,
    anchorPos: Pos2D,
    chest: ChestStorage,
): boolean {
    let moved = false;
    for (let j = 0; j < 64; j++) {
        const slot = chest.getSlot(anchorPos, j);
        if (slot === null) continue;
        const added = addItemToCart(cart, slot.itemId, slot.count);
        if (added > 0) {
            const remaining = slot.count - added;
            chest.setSlot(anchorPos, j, remaining > 0 ? { itemId: slot.itemId, count: remaining } : null);
            moved = true;
        }
    }
    return moved;
}

function loadAutoToCart(
    cart: ICartWriter,
    anchorPos: Pos2D,
    autoStorage: AutoProcessingStorage,
    voxelMap: IVoxelWriter,
): boolean {
    let moved = false;
    const outputs = autoStorage.getOutputs(anchorPos);
    for (let j = 0; j < outputs.length; j++) {
        const slot = outputs[j];
        if (slot === null) continue;
        const added = addItemToCart(cart, slot.itemId, slot.count);
        if (added > 0) {
            const remaining = slot.count - added;
            autoStorage.setOutput(anchorPos, j, remaining > 0 ? { itemId: slot.itemId, count: remaining } : null, voxelMap);
            moved = true;
        }
    }
    return moved;
}

function loadDailyToCart(
    cart: ICartWriter,
    anchorPos: Pos2D,
    dailyStorage: DailyProcessingStorage,
    voxelMap: IVoxelWriter,
): boolean {
    let moved = false;
    for (const idx of [0, 1] as const) {
        const slot = dailyStorage.getOutput(anchorPos, idx);
        if (slot === null) continue;
        const added = addItemToCart(cart, slot.itemId, slot.count);
        if (added > 0) {
            const remaining = slot.count - added;
            // setOutput(index=0) は enabled ビットも更新するため必ず setOutput 経由で呼ぶ
            dailyStorage.setOutput(anchorPos, idx, remaining > 0 ? { itemId: slot.itemId, count: remaining } : null, voxelMap);
            moved = true;
        }
    }
    return moved;
}

// ---------------------------------------------------------------------------
// 公開エントリポイント
// ---------------------------------------------------------------------------

/**
 * カートが新タイルに踏み込んだ瞬間に呼ぶ。
 * カートの現在タイルに隣接する全ステーションについて搬送アクションを実行する。
 * 実際に1個でも移動した場合のみ station_fired を発行する。
 */
export function executeStationTransfersOnCartEnter(
    voxelMap: IVoxelWriter,
    cart: ICartWriter,
    eventBroker: IEventBroker,
): void {
    if (!chestStorageRef || !dailyStorageRef || !autoStorageRef) return;

    const T: Pos2D = {
        x: Math.floor(cart.posInWorld.x),
        z: Math.floor(cart.posInWorld.z),
    };

    // 4方向の隣接タイルを順に確認する
    const directions: { vec: Vec2; side: StationSide }[] = [
        { vec: { dx: 0, dz: -1 }, side: "up" },
        { vec: { dx: 0, dz:  1 }, side: "down" },
        { vec: { dx: -1, dz: 0 }, side: "left" },
        { vec: { dx:  1, dz: 0 }, side: "right" },
    ];

    for (const { vec: d } of directions) {
        // S = T + d: ステーション候補タイル
        const S: Pos2D = { x: T.x + d.dx, z: T.z + d.dz };
        const sSurface = voxelMap.getSurfacePosition({ x: S.x, y: 0, z: S.z });
        const sVoxel = voxelMap.get(sSurface);
        if (getEntityTypeFromVoxel(sVoxel) !== ENTITY_TYPES.station) continue;

        const restSide = getStationRestSide(sVoxel);
        const restVec = sideToVec(restSide);

        // restSide の方向ベクトルが d または -d と平行でなければ直交 → 素通り
        if (!isParallel(restVec, d)) continue;

        // E = S + d: 施設タイル候補
        const E: Pos2D = { x: S.x + d.dx, z: S.z + d.dz };

        // facility_part を含む多タイル施設のアンカーを解決する
        let anchorPos: Pos2D;
        let facilityEntityType: number;
        try {
            const anchor = findFacilityAnchor(voxelMap, E.x, E.z);
            anchorPos = { x: anchor.anchorX, z: anchor.anchorZ };
            facilityEntityType = anchor.entityType;
        } catch {
            continue;
        }
        if (facilityEntityType === ENTITY_TYPES.none) continue;

        // ローダー / アンローダー判定
        // restVec == d: フォーク休止辺がエンティティ側 → ローダー（E出力 → カート）
        // restVec == -d: フォーク休止辺がカート側 → アンローダー（カート → E入力）
        const isLoader = (restVec.dx === d.dx && restVec.dz === d.dz);

        let moved = false;
        let representativeItemId: string | null = null;

        if (facilityEntityType === ENTITY_TYPES.chest) {
            if (isLoader) {
                moved = loadChestToCart(cart, anchorPos, chestStorageRef);
                if (moved) {
                    // 移動後の代表アイテムを出力スロットから取得（移動済みなのでカートから取る）
                    for (const slot of cart.inventorySlots) {
                        if (slot !== null) { representativeItemId = slot.itemId; break; }
                    }
                }
            } else {
                moved = unloadCartToChest(cart, anchorPos, chestStorageRef);
                if (moved) {
                    // アンロードした代表アイテムはカートのスロットから探す（移動後は減っている）
                    // チェストから代表を取る
                    for (let j = 0; j < 64; j++) {
                        const slot = chestStorageRef.getSlot(anchorPos, j);
                        if (slot !== null) { representativeItemId = slot.itemId; break; }
                    }
                }
            }
        } else if (AUTO_PROCESSING_DEFS[facilityEntityType] !== undefined) {
            if (isLoader) {
                moved = loadAutoToCart(cart, anchorPos, autoStorageRef, voxelMap);
                if (moved) {
                    for (const slot of cart.inventorySlots) {
                        if (slot !== null) { representativeItemId = slot.itemId; break; }
                    }
                }
            } else {
                moved = unloadCartToAuto(cart, anchorPos, autoStorageRef, voxelMap);
                if (moved) {
                    for (let j = 0; j < 8; j++) {
                        const slot = autoStorageRef.getInput(anchorPos, j);
                        if (slot !== null) { representativeItemId = slot.itemId; break; }
                    }
                }
            }
        } else if (DAILY_PROCESSING_DEFS[facilityEntityType] !== undefined) {
            if (isLoader) {
                moved = loadDailyToCart(cart, anchorPos, dailyStorageRef, voxelMap);
                if (moved) {
                    for (const slot of cart.inventorySlots) {
                        if (slot !== null) { representativeItemId = slot.itemId; break; }
                    }
                }
            } else {
                moved = unloadCartToDaily(cart, anchorPos, dailyStorageRef, voxelMap);
                if (moved) {
                    const inputSlot = dailyStorageRef.getInput(anchorPos);
                    if (inputSlot !== null) representativeItemId = inputSlot.itemId;
                }
            }
        } else {
            // 未対応エンティティ
            continue;
        }

        if (moved && representativeItemId !== null) {
            eventBroker.publish("station_fired", {
                stationPos: S,
                restSide,
                itemId: representativeItemId,
            });
        }
    }
}
