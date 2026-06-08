import type { ICartWriter, IEventBroker, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { autoProcessingCanAcceptInput } from "../_registry/entities/AutoProcessing";
import { dailyProcessingCanAcceptInput } from "../_registry/entities/DailyProcessing";
import { findFacilityAnchor } from "../_registry/facilityUtil";
import { getItemDef, getItemDefByEntityType } from "../_registry/ItemRegistry";
import { AUTO_PROCESSING_DEFS, DAILY_PROCESSING_DEFS } from "../_registry/ProcessingRecipes";
import type { BonfireStorage } from "./BonfireStorage";
import type { SlotStorage } from "./SlotStorage";
import type { StorageVault } from "./StorageVault";
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
        case "up":
            return { dx: 0, dz: -1 };
        case "down":
            return { dx: 0, dz: 1 };
        case "left":
            return { dx: -1, dz: 0 };
        case "right":
            return { dx: 1, dz: 0 };
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

let bonfireStorageRef: BonfireStorage | null = null;
let chestStorageRef: SlotStorage | null = null;
let storageVaultRef: StorageVault | null = null;

/**
 * App.tsx から各ストレージを注入する。
 * chest / daily / auto などの座標ベース収納は storageVault から取得する。
 */
export function setStationStorages(bonfire: BonfireStorage, chest: SlotStorage, storageVault: StorageVault): void {
    bonfireStorageRef = bonfire;
    chestStorageRef = chest;
    storageVaultRef = storageVault;
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

function unloadCartToChest(cart: ICartWriter, anchorPos: Pos2D): boolean {
    const chest = chestStorageRef;
    if (!chest) return false;
    let moved = false;
    for (let i = 0; i < cart.inventorySlots.length; i++) {
        const slot = cart.inventorySlots[i];
        if (slot === null) continue;
        const itemId = slot.itemId;
        const maxStack = getItemDef(itemId)?.maxStack ?? 64;
        let remaining = slot.count;

        // 既存スタックに積む
        for (let j = 0; j < 64 && remaining > 0; j++) {
            const chestSlot = chest.getSlot(anchorPos, "main", j);
            if (chestSlot === null || chestSlot.itemId !== itemId) continue;
            if (chestSlot.count >= maxStack) continue;
            const space = maxStack - chestSlot.count;
            const add = Math.min(space, remaining);
            chest.setSlot(anchorPos, "main", j, { itemId: chestSlot.itemId, count: chestSlot.count + add });
            remaining -= add;
            moved = true;
        }
        // 空きスロットに新規
        for (let j = 0; j < 64 && remaining > 0; j++) {
            const chestSlot = chest.getSlot(anchorPos, "main", j);
            if (chestSlot !== null) continue;
            const add = Math.min(maxStack, remaining);
            chest.setSlot(anchorPos, "main", j, { itemId: itemId as never, count: add });
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

function unloadCartToAuto(cart: ICartWriter, anchorPos: Pos2D, voxelMap: IVoxelWriter): boolean {
    if (!storageVaultRef) return false;
    const entityType = getEntityTypeFromVoxel(voxelMap.getSurface(anchorPos));
    const storageId = getItemDefByEntityType(entityType)?.itemId ?? "none";
    if (storageId === "none") return false;
    const auto = storageVaultRef.get<SlotStorage>(storageId);
    const inputLength = auto.getSlots(anchorPos)?.input.length ?? 0;

    let moved = false;
    for (let i = 0; i < cart.inventorySlots.length; i++) {
        const slot = cart.inventorySlots[i];
        if (slot === null) continue;
        if (!autoProcessingCanAcceptInput(slot.itemId, entityType)) continue;

        const itemId = slot.itemId;
        const maxStack = getItemDef(itemId)?.maxStack ?? 64;
        let remaining = slot.count;

        // 既存スタックに積む
        for (let j = 0; j < inputLength && remaining > 0; j++) {
            const inputSlot = auto.getSlot(anchorPos, "input", j);
            if (inputSlot === null || inputSlot.itemId !== itemId) continue;
            if (inputSlot.count >= maxStack) continue;
            const space = maxStack - inputSlot.count;
            const add = Math.min(space, remaining);
            auto.setSlot(anchorPos, "input", j, { itemId: inputSlot.itemId, count: inputSlot.count + add });
            remaining -= add;
            moved = true;
        }
        // 空きスロットに新規
        for (let j = 0; j < inputLength && remaining > 0; j++) {
            if (auto.getSlot(anchorPos, "input", j) !== null) continue;
            const add = Math.min(maxStack, remaining);
            auto.setSlot(anchorPos, "input", j, { itemId, count: add });
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

function unloadCartToDaily(cart: ICartWriter, anchorPos: Pos2D, voxelMap: IVoxelWriter): boolean {
    if (!storageVaultRef) return false;
    const entityType = getEntityTypeFromVoxel(voxelMap.getSurface(anchorPos));
    const itemDef = getItemDefByEntityType(entityType);
    if (itemDef === undefined) throw new Error(`No itemId for entity type ${entityType}`);
    const daily = storageVaultRef.get<SlotStorage>(itemDef.itemId);

    // 日次処理は入力1スロット。同 itemId にマージしつつ最大スタックまで積む。
    let moved = false;
    for (let i = 0; i < cart.inventorySlots.length; i++) {
        const slot = cart.inventorySlots[i];
        if (slot === null) continue;
        // 受理不可アイテム（その施設のレシピ入力でないもの）はカートから移さない。
        if (!dailyProcessingCanAcceptInput(anchorPos, slot.itemId, voxelMap)) continue;
        const input = daily.getSlot(anchorPos, "input", 0);
        if (input !== null && input.itemId !== slot.itemId) continue;
        const maxStack = getItemDef(slot.itemId)?.maxStack ?? 64;
        const existing = input?.count ?? 0;
        const space = maxStack - existing;
        if (space <= 0) continue;
        const add = Math.min(space, slot.count);
        daily.setSlot(anchorPos, "input", 0, { itemId: slot.itemId, count: existing + add });
        const remaining = slot.count - add;
        cart.setInventorySlot(i, remaining > 0 ? { itemId: slot.itemId, count: remaining } : null);
        moved = true;
    }
    return moved;
}

function unloadCartToBonfire(cart: ICartWriter, anchorPos: Pos2D, bonfireStorage: BonfireStorage, voxelMap: IVoxelWriter): boolean {
    let moved = false;
    // 各カートスロットを「燃料 / 素材」に振り分けて addToInputSlot に渡す。
    // addToInputSlot が容量・単一 itemId 制約・enabled 更新を内包するため、ここではマージ計算不要。
    for (let i = 0; i < cart.inventorySlots.length; i++) {
        const slot = cart.inventorySlots[i];
        if (slot === null) continue;

        const kind: "fuel" | "material" | null = bonfireStorage.canAcceptFuel(slot.itemId)
            ? "fuel"
            : bonfireStorage.canAcceptMaterial(slot.itemId)
              ? "material"
              : null;
        if (kind === null) continue;

        const movedCount = bonfireStorage.addToInputSlot(anchorPos, kind, slot.itemId, slot.count, voxelMap);
        if (movedCount <= 0) continue;
        const remaining = slot.count - movedCount;
        cart.setInventorySlot(i, remaining > 0 ? { itemId: slot.itemId, count: remaining } : null);
        moved = true;
    }
    return moved;
}

// ---------------------------------------------------------------------------
// ローダー: 施設出力 → カート
// ---------------------------------------------------------------------------

function loadChestToCart(cart: ICartWriter, anchorPos: Pos2D): boolean {
    const chest = chestStorageRef;
    if (!chest) return false;
    let moved = false;
    for (let j = 0; j < 64; j++) {
        const slot = chest.getSlot(anchorPos, "main", j);
        if (slot === null) continue;
        const added = addItemToCart(cart, slot.itemId, slot.count);
        if (added > 0) {
            const remaining = slot.count - added;
            chest.setSlot(anchorPos, "main", j, remaining > 0 ? { itemId: slot.itemId, count: remaining } : null);
            moved = true;
        }
    }
    return moved;
}

function loadAutoToCart(cart: ICartWriter, anchorPos: Pos2D, voxelMap: IVoxelWriter): boolean {
    if (!storageVaultRef) return false;
    const entityType = getEntityTypeFromVoxel(voxelMap.getSurface(anchorPos));
    const storageId = getItemDefByEntityType(entityType)?.itemId ?? "none";
    if (storageId === "none") return false;
    const auto = storageVaultRef.get<SlotStorage>(storageId);

    let moved = false;
    const outputLength = auto.getSlots(anchorPos)?.output.length ?? 0;
    for (let j = 0; j < outputLength; j++) {
        const slot = auto.getSlot(anchorPos, "output", j);
        if (slot === null) continue;
        const added = addItemToCart(cart, slot.itemId, slot.count);
        if (added > 0) {
            const remaining = slot.count - added;
            auto.setSlot(anchorPos, "output", j, remaining > 0 ? { itemId: slot.itemId, count: remaining } : null);
            moved = true;
        }
    }
    return moved;
}

function loadBonfireToCart(cart: ICartWriter, anchorPos: Pos2D, bonfireStorage: BonfireStorage, voxelMap: IVoxelWriter): boolean {
    let moved = false;
    // 草木灰（outputAsh）と蒸し系（outputSteamed）の2出力をカートへ排出する。
    for (const kind of ["outputAsh", "outputSteamed"] as const) {
        const slot = bonfireStorage.getSlot(anchorPos, kind);
        if (slot === null) continue;
        const added = addItemToCart(cart, slot.itemId, slot.count);
        if (added > 0) {
            const remaining = slot.count - added;
            bonfireStorage.setSlot(anchorPos, kind, remaining > 0 ? { itemId: slot.itemId, count: remaining } : null, voxelMap);
            moved = true;
        }
    }
    return moved;
}

function loadDailyToCart(cart: ICartWriter, anchorPos: Pos2D, voxelMap: IVoxelWriter): boolean {
    if (!storageVaultRef) return false;
    const entityType = getEntityTypeFromVoxel(voxelMap.getSurface(anchorPos));
    const itemId = getItemDefByEntityType(entityType)?.itemId ?? "none";
    if (itemId === "none") return false;
    const daily = storageVaultRef.get<SlotStorage>(itemId);

    let moved = false;
    for (const idx of [0, 1] as const) {
        const slot = daily.getSlot(anchorPos, "output", idx);
        if (slot === null) continue;
        const added = addItemToCart(cart, slot.itemId, slot.count);
        if (added > 0) {
            const remaining = slot.count - added;
            daily.setSlot(anchorPos, "output", idx, remaining > 0 ? { itemId: slot.itemId, count: remaining } : null);
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
export function executeStationTransfersOnCartEnter(voxelMap: IVoxelWriter, cart: ICartWriter, eventBroker: IEventBroker): void {
    if (!bonfireStorageRef) return;

    const T: Pos2D = {
        x: Math.floor(cart.posInWorld.x),
        z: Math.floor(cart.posInWorld.z),
    };

    // 4方向の隣接タイルを順に確認する
    const directions: { vec: Vec2; side: StationSide }[] = [
        { vec: { dx: 0, dz: -1 }, side: "up" },
        { vec: { dx: 0, dz: 1 }, side: "down" },
        { vec: { dx: -1, dz: 0 }, side: "left" },
        { vec: { dx: 1, dz: 0 }, side: "right" },
    ];

    for (const { vec: d } of directions) {
        // S = T + d: ステーション候補タイル
        const S: Pos2D = { x: T.x + d.dx, z: T.z + d.dz };
        const sSurface = voxelMap.getSurfacePosition(S);
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
        const isLoader = restVec.dx === d.dx && restVec.dz === d.dz;

        let moved = false;
        let representativeItemId: string | null = null;

        if (facilityEntityType === ENTITY_TYPES.chest) {
            if (isLoader) {
                moved = loadChestToCart(cart, anchorPos);
                if (moved) {
                    // 移動後の代表アイテムを出力スロットから取得（移動済みなのでカートから取る）
                    for (const slot of cart.inventorySlots) {
                        if (slot !== null) {
                            representativeItemId = slot.itemId;
                            break;
                        }
                    }
                }
            } else {
                moved = unloadCartToChest(cart, anchorPos);
                if (moved) {
                    // アンロードした代表アイテムはカートのスロットから探す（移動後は減っている）
                    // チェストから代表を取る
                    for (let j = 0; j < 64; j++) {
                        const slot = chestStorageRef?.getSlot(anchorPos, "main", j) ?? null;
                        if (slot !== null) {
                            representativeItemId = slot.itemId;
                            break;
                        }
                    }
                }
            }
        } else if (AUTO_PROCESSING_DEFS[facilityEntityType] !== undefined) {
            if (isLoader) {
                moved = loadAutoToCart(cart, anchorPos, voxelMap);
                if (moved) {
                    for (const slot of cart.inventorySlots) {
                        if (slot !== null) {
                            representativeItemId = slot.itemId;
                            break;
                        }
                    }
                }
            } else {
                moved = unloadCartToAuto(cart, anchorPos, voxelMap);
                const entityType = getEntityTypeFromVoxel(voxelMap.getSurface(anchorPos));
                const storageId = getItemDefByEntityType(entityType)?.itemId ?? "none";
                if (moved && storageId !== "none") {
                    const auto = storageVaultRef?.get<SlotStorage>(storageId);
                    for (let j = 0; j < 8; j++) {
                        const slot = auto?.getSlot(anchorPos, "input", j) ?? null;
                        if (slot !== null) {
                            representativeItemId = slot.itemId;
                            break;
                        }
                    }
                }
            }
        } else if (DAILY_PROCESSING_DEFS[facilityEntityType] !== undefined) {
            if (isLoader) {
                moved = loadDailyToCart(cart, anchorPos, voxelMap);
                if (moved) {
                    for (const slot of cart.inventorySlots) {
                        if (slot !== null) {
                            representativeItemId = slot.itemId;
                            break;
                        }
                    }
                }
            } else {
                moved = unloadCartToDaily(cart, anchorPos, voxelMap);
                if (moved) {
                    const dailyItemId = getItemDefByEntityType(facilityEntityType)?.itemId ?? "none";
                    const inputSlot = dailyItemId !== "none" ? (storageVaultRef?.get<SlotStorage>(dailyItemId).getSlot(anchorPos, "input", 0) ?? null) : null;
                    if (inputSlot !== null) representativeItemId = inputSlot.itemId;
                }
            }
        } else if (facilityEntityType === ENTITY_TYPES.bonfire) {
            if (isLoader) {
                moved = loadBonfireToCart(cart, anchorPos, bonfireStorageRef, voxelMap);
                if (moved) {
                    for (const slot of cart.inventorySlots) {
                        if (slot !== null) {
                            representativeItemId = slot.itemId;
                            break;
                        }
                    }
                }
            } else {
                moved = unloadCartToBonfire(cart, anchorPos, bonfireStorageRef, voxelMap);
                if (moved) {
                    const fuelSlot = bonfireStorageRef.getSlot(anchorPos, "fuel");
                    const materialSlot = bonfireStorageRef.getSlot(anchorPos, "material");
                    representativeItemId = fuelSlot?.itemId ?? materialSlot?.itemId ?? null;
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
