import type { ICartWriter, IEventBroker, ItemStack, IVoxelWriter, Pos2D, Pos3D } from "../_boundary/interfaces";
import { CART_ATTACHMENT_ALLOWED, FERTILIZER_ITEMS, SEED_TO_ENTITY } from "./CartItems";
import { CROP_DEFS, getFertilizerYieldMultiplier } from "./CropDefs";
import type { ItemId } from "./ItemDefs";
import {
    ENTITY_TYPES,
    getDaysElapsedFromVoxel,
    getEntityTypeFromVoxel,
    getFatigueFromVoxel,
    getFertilizerTypeFromVoxel,
    getLastCropFromVoxel,
    getTerrainTypeFromVoxel,
    initializeVoxel,
    setEntityTypeInVoxel,
    setFatigueInVoxel,
    setFertilizerTypeInVoxel,
    setLastCropInVoxel,
    TERRAIN_TYPES,
} from "./VoxelDefs";

// ---------------------------------------------------------------------------
// 収穫物マッピングテーブル
// ---------------------------------------------------------------------------

type HarvestProduct = { itemId: ItemId; count: number };

function harvestProducts(entityType: number, count: number): HarvestProduct[] {
    switch (entityType) {
        case ENTITY_TYPES.potato:
            return [
                { itemId: "potato", count },
                { itemId: "stem", count },
            ];
        case ENTITY_TYPES.soy:
            return [{ itemId: "pods", count }];
        case ENTITY_TYPES.flax:
            return [
                { itemId: "flaxseed", count },
                { itemId: "flax_stalk", count },
            ];
        case ENTITY_TYPES.sunflower:
            return [
                { itemId: "sunflower_seed", count },
                { itemId: "stem", count },
            ];
        case ENTITY_TYPES.wheat:
            return [
                { itemId: "wheat", count },
                { itemId: "stem", count },
            ];
        default:
            return [];
    }
}

// ---------------------------------------------------------------------------
// アイテム定義（maxStack）の参照
// 既存スタック積み上げ + 新規スロット確保のためにのみ使う定数マップ
// ---------------------------------------------------------------------------

const ITEM_MAX_STACK: ReadonlyMap<ItemId, number> = new Map<ItemId, number>([
    ["potato", 64],
    ["stem", 64],
    ["pods", 64],
    ["flaxseed", 64],
    ["flax_stalk", 64],
    ["sunflower_seed", 64],
]);

// ---------------------------------------------------------------------------
// カートインベントリへのアトミックな複数アイテム追加
// ---------------------------------------------------------------------------

/**
 * カートの inventorySlots に items を追加する（アトミック）。
 * 全アイテムが収まる場合のみ変更を確定し true を返す。
 * 1個でも収まらない場合は変更せず false を返す。
 *
 * 戦略:
 *   Phase 1: 既存スタックに積む（maxStack まで）
 *   Phase 2: 空きスロットに新規作成
 */
function addItemsToCart(cart: ICartWriter, items: ReadonlyArray<HarvestProduct>): boolean {
    // 作業用のスロット配列コピー（変更を試みてから確定する）
    const slots = cart.inventorySlots.map((s) => (s ? { ...s } : null));

    for (const { itemId, count } of items) {
        let remaining = count;
        const maxStack = ITEM_MAX_STACK.get(itemId) ?? 64;

        // Phase 1: 既存スタックに積む
        for (const slot of slots) {
            if (slot && slot.itemId === itemId && slot.count < maxStack) {
                const space = maxStack - slot.count;
                const add = Math.min(remaining, space);
                slot.count += add;
                remaining -= add;
                if (remaining <= 0) break;
            }
        }

        // Phase 2: 空きスロットに新規作成
        if (remaining > 0) {
            for (let i = 0; i < slots.length; i++) {
                if (slots[i] === null) {
                    const add = Math.min(remaining, maxStack);
                    slots[i] = { itemId, count: add };
                    remaining -= add;
                    if (remaining <= 0) break;
                }
            }
        }

        if (remaining > 0) {
            // 収まらない → 変更を破棄して false
            return false;
        }
    }

    // 全アイテムが収まった → cart に反映
    for (let i = 0; i < slots.length; i++) {
        cart.setInventorySlot(i, slots[i] as ItemStack | null);
    }
    return true;
}

// ---------------------------------------------------------------------------
// カートインベントリから1個消費するヘルパー
// ---------------------------------------------------------------------------

/**
 * cart.inventorySlots の index 番目のスロットから 1 個消費する。
 * スタックが 0 になった場合は null に置き換える。
 */
function consumeOneFromSlot(cart: ICartWriter, slotIndex: number): void {
    const slot = cart.inventorySlots[slotIndex];
    if (!slot) return;
    if (slot.count <= 1) {
        cart.setInventorySlot(slotIndex, null);
    } else {
        cart.setInventorySlot(slotIndex, { itemId: slot.itemId, count: slot.count - 1 });
    }
}

// ---------------------------------------------------------------------------
// 左右タイルの座標オフセット計算
// ---------------------------------------------------------------------------

type Offset = { dx: number; dz: number };

/** facing から左右タイルの offset を返す。[left, right] の順。 */
function sideOffsets(facing: string): [Offset, Offset] {
    switch (facing) {
        case "right":
            return [
                { dx: 0, dz: -1 },
                { dx: 0, dz: 1 },
            ];
        case "left":
            return [
                { dx: 0, dz: 1 },
                { dx: 0, dz: -1 },
            ];
        case "down":
            return [
                { dx: 1, dz: 0 },
                { dx: -1, dz: 0 },
            ];
        case "up":
            return [
                { dx: -1, dz: 0 },
                { dx: 1, dz: 0 },
            ];
        default:
            return [
                { dx: 0, dz: 0 },
                { dx: 0, dz: 0 },
            ];
    }
}

// ---------------------------------------------------------------------------
// 散布処理（アタッチメントなしの場合）
// ---------------------------------------------------------------------------

function scatterOnTile(voxelMap: IVoxelWriter, cart: ICartWriter, tilePos: Pos2D, eventBroker: IEventBroker): void {
    const surfacePos: Pos3D = voxelMap.getSurfacePosition(tilePos);
    const voxel = voxelMap.get(surfacePos);
    const terrainType = getTerrainTypeFromVoxel(voxel);

    // soil または wetSoil 以外は何もしない
    if (terrainType !== TERRAIN_TYPES.soil && terrainType !== TERRAIN_TYPES.wetSoil) return;

    // カートインベントリを index 0 から走査して最初の非空スロットを探す
    const slots = cart.inventorySlots;
    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot) continue;

        const itemId = slot.itemId as ItemId;

        // 種・種イモ系 → 植え付け
        const entityType = SEED_TO_ENTITY.get(itemId);
        if (entityType !== undefined) {
            // エンティティが既にあれば植え付け不可
            if (getEntityTypeFromVoxel(voxel) !== ENTITY_TYPES.none) return;

            const cropDef = CROP_DEFS[entityType];
            if (!cropDef) return;

            // 連作疲労チェック
            const lastCrop = getLastCropFromVoxel(voxel);
            let fatigue = getFatigueFromVoxel(voxel);
            if (lastCrop === entityType) {
                fatigue += 1;
            } else if (lastCrop !== ENTITY_TYPES.none) {
                fatigue = Math.max(0, fatigue - 1);
            }
            if (fatigue >= cropDef.fatigueThreshold) return;

            // 植え付け実行
            let newVoxel = initializeVoxel(terrainType);
            newVoxel = setEntityTypeInVoxel(newVoxel, entityType);
            newVoxel = setFatigueInVoxel(newVoxel, fatigue);
            newVoxel = setLastCropInVoxel(newVoxel, entityType);
            newVoxel = setFertilizerTypeInVoxel(newVoxel, getFertilizerTypeFromVoxel(voxel));
            voxelMap.set(newVoxel, surfacePos);

            consumeOneFromSlot(cart, i);

            eventBroker.publish("crop_planted", {
                pos: { x: surfacePos.x, z: surfacePos.z },
                cropType: itemId,
            });
            return;
        }

        // 肥料系 → 施肥
        const fertType = FERTILIZER_ITEMS.get(itemId);
        if (fertType !== undefined) {
            // 既に施肥済みなら何もしない
            if (getFertilizerTypeFromVoxel(voxel) !== 0) return;

            voxelMap.set(setFertilizerTypeInVoxel(voxel, fertType), surfacePos);
            consumeOneFromSlot(cart, i);
            return;
        }

        // それ以外のアイテム → 何もしない（消費なし）
        return;
    }
}

// ---------------------------------------------------------------------------
// 収穫処理（アタッチメントが sickle の場合）
// ---------------------------------------------------------------------------

function harvestOnTile(voxelMap: IVoxelWriter, cart: ICartWriter, tilePos: Pos2D, eventBroker: IEventBroker): void {
    const surfacePos: Pos3D = voxelMap.getSurfacePosition(tilePos);
    const voxel = voxelMap.get(surfacePos);
    const entityType = getEntityTypeFromVoxel(voxel);

    const cropDef = CROP_DEFS[entityType];
    if (!cropDef) return;

    // 収穫適期チェック
    const dayCounter = getDaysElapsedFromVoxel(voxel);
    if (dayCounter < cropDef.maturityDay || dayCounter >= cropDef.witherDay) return;

    // 収穫量計算
    const baseCount = 2 + Math.random() * 3; // 2-4
    const fertType = getFertilizerTypeFromVoxel(voxel);
    const fertMultiplier = getFertilizerYieldMultiplier(entityType, fertType);
    const fatigue = getFatigueFromVoxel(voxel);
    const fatigueMultiplier = fatigue === 0 ? 1.0 : fatigue === 1 ? 0.7 : 0.4;
    const harvestCount = Math.max(1, Math.floor(baseCount * fertMultiplier * fatigueMultiplier));

    const products = harvestProducts(entityType, harvestCount);
    if (products.length === 0) return;

    // カートインベントリへアトミックに追加（失敗なら voxel を変更しない）
    if (!addItemsToCart(cart, products)) return;

    // voxel をリセット（lastCrop と fatigue を保持）
    let afterVoxel: bigint = initializeVoxel(getTerrainTypeFromVoxel(voxel));
    afterVoxel = setLastCropInVoxel(afterVoxel, entityType);
    afterVoxel = setFatigueInVoxel(afterVoxel, fatigue);
    voxelMap.set(afterVoxel, surfacePos);

    // crop_harvested イベントを作物ごとのメインアイテムで発火
    const mainProduct = products[0];
    eventBroker.publish("crop_harvested", {
        pos: { x: surfacePos.x, z: surfacePos.z },
        itemId: mainProduct.itemId,
        count: harvestCount,
    });
}

// ---------------------------------------------------------------------------
// 公開エントリポイント
// ---------------------------------------------------------------------------

/**
 * カートが新タイルに踏み込んだ瞬間に呼ぶ。
 * 進行方向に対する左右 1 タイルに対してアタッチメントに応じたアクションを実行する。
 */
export function executeCartActionsOnEnterTile(voxelMap: IVoxelWriter, cart: ICartWriter, eventBroker: IEventBroker): void {
    const cx = Math.floor(cart.posInWorld.x);
    const cz = Math.floor(cart.posInWorld.z);

    const [leftOffset, rightOffset] = sideOffsets(cart.facing);
    const sideTiles: Pos2D[] = [
        { x: cx + leftOffset.dx, z: cz + leftOffset.dz },
        { x: cx + rightOffset.dx, z: cz + rightOffset.dz },
    ];

    const attachmentItemId = cart.attachmentSlot?.itemId ?? null;

    if (attachmentItemId !== null && CART_ATTACHMENT_ALLOWED.has(attachmentItemId as ItemId) && attachmentItemId === "sickle") {
        // 収穫動作
        for (const tilePos of sideTiles) {
            harvestOnTile(voxelMap, cart, tilePos, eventBroker);
        }
    } else if (attachmentItemId === null) {
        // 散布動作
        for (const tilePos of sideTiles) {
            scatterOnTile(voxelMap, cart, tilePos, eventBroker);
        }
    }
    // それ以外（将来拡張用）は何もしない
}
