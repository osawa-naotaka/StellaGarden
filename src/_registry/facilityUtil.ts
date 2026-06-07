import type { IInventoryWriter, ItemId, ItemStack, IVoxelReader, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import {
    ENTITY_TYPES,
    getDisplacementXFromVoxel,
    getDisplacementZFromVoxel,
    getEntityTypeFromVoxel,
    getVariantFromVoxel,
    placeEntity,
    setDisplacementXInVoxel,
    setDisplacementZInVoxel,
    setEntityTypeInVoxel,
} from "../engine/VoxelDefs";
import { getEntityDef } from "./EntityRegistry";
import { getItemDefByEntityType, type PlacementVariant } from "./ItemRegistry";

/**
 * 配置不可（地形生成のみで出現）の多タイルエンティティのサイズ登録。
 * placeable な item.placement.entitySize が無いエンティティを
 * findFacilityAnchor で解決できるようにするための補助レジストリ。
 */
const multiTileEntitySizes = new Map<number, { w: number; h: number }>();

export function registerMultiTileEntitySize(entityType: number, size: { w: number; h: number }): void {
    multiTileEntitySizes.set(entityType, size);
}

/** エンティティタイプからサイズを解決する。 placeable item > 非配置型レジストリ の順で参照。 */
function getEntitySize(entityType: number, variant: PlacementVariant): { w: number; h: number } {
    return getEntityDef(entityType).getEntitySize(variant);
}

/**
 * 施設を撤去してインベントリに回収する。成功時 true。
 *
 * `extraItems` には施設に格納されていた中身（チェスト内アイテム、処理機の入出力スロットなど）を渡す。
 * 施設本体 + extraItems を `inventory.addItems` でアトミックに追加するため、
 * インベントリが満杯で全部が入りきらない場合は撤去自体がキャンセルされ、何も失われない。
 */
export function removeFacility(
    voxelMap: IVoxelWriter,
    inventory: IInventoryWriter,
    anchorX: number,
    anchorZ: number,
    entityType: number,
    variant: PlacementVariant,
    extraItems: ReadonlyArray<ItemStack> = [],
): boolean {
    const def = getItemDefByEntityType(entityType);
    if (!def) return false;
    if (!def.placement) return false;
    const itemsToReturn: { itemId: ItemId; count: number }[] = [{ itemId: def.itemId as ItemId, count: 1 }];
    for (const stack of extraItems) {
        itemsToReturn.push({ itemId: stack.itemId, count: stack.count });
    }
    if (!inventory.addItems(itemsToReturn)) return false;

    const { w, h } = getEntitySize(def.placement.entityType, variant);
    for (let dz = 0; dz < h; dz++) {
        for (let dx = 0; dx < w; dx++) {
            const pos = voxelMap.getSurfacePosition({ x: anchorX + dx, z: anchorZ + dz });
            const v = voxelMap.get(pos);
            voxelMap.set(setEntityTypeInVoxel(v, ENTITY_TYPES.none), pos);
        }
    }
    return true;
}

/** ctx の surfacePos からアンカーを解決し、施設を撤去する。成功時 true。 */
export function removeFacilityAtPos(
    voxelMap: IVoxelWriter,
    inventory: IInventoryWriter,
    x: number,
    z: number,
    expectedEntityType: number,
    extraItems: ReadonlyArray<ItemStack> = [],
): boolean {
    const anchor = findFacilityAnchor(voxelMap, x, z);
    if (!anchor || anchor.entityType !== expectedEntityType) return false;
    return removeFacility(voxelMap, inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType, anchor.variant, extraItems);
}

/** 施設をフィールドに配置する（アンカー + facility_part の voxel 書き込み）。 */
export function placeFacility(voxelMap: IVoxelWriter, pos: Pos2D, entityType: number, entitySize: { w: number; h: number }): void {
    for (let dz = 0; dz < entitySize.h; dz++) {
        for (let dx = 0; dx < entitySize.w; dx++) {
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x + dx, z: pos.z + dz });
            const voxel = voxelMap.get(surfacePos);
            if (dx === 0 && dz === 0) {
                const anchorVoxel = placeEntity(voxel, entityType);
                voxelMap.set(anchorVoxel, surfacePos);
            } else {
                let facilityVoxel = placeEntity(voxel, ENTITY_TYPES.facility_part);
                facilityVoxel = setDisplacementXInVoxel(facilityVoxel, dx);
                facilityVoxel = setDisplacementZInVoxel(facilityVoxel, dz);
                voxelMap.set(facilityVoxel, surfacePos);
            }
        }
    }
}

/**
 * 指定座標が施設（アンカーまたは facility_part）の場合、
 * アンカーの位置・エンティティタイプ・サイズを返す。施設でなければ null。
 * 配置可能施設は ItemDef も返す（removeFacility 用）。
 */
export function findFacilityAnchor(
    voxelMap: IVoxelReader,
    x: number,
    z: number,
): { anchorX: number; anchorZ: number; entityType: number; variant: PlacementVariant; size: { w: number; h: number } } {
    const surfacePos = voxelMap.getSurfacePosition({ x, z });
    const voxel = voxelMap.get(surfacePos);
    const entityType = getEntityTypeFromVoxel(voxel);
    const variant = getVariantFromVoxel(voxel);

    if (entityType === ENTITY_TYPES.none) throw new Error("entity is empty.");

    // facility_part の場合: 近傍を探索してアンカーを見つける
    if (entityType !== ENTITY_TYPES.facility_part) {
        // アンカータイルの場合: 直接返す
        const size = getEntitySize(entityType, variant);
        return { anchorX: x, anchorZ: z, entityType, variant, size };
    }

    // voxel内のdisplacementを取得してアンカーを見つける
    const anchorX = x - getDisplacementXFromVoxel(voxel);
    const anchorZ = z - getDisplacementZFromVoxel(voxel);
    const nSurfacePos = voxelMap.getSurfacePosition({ x: anchorX, z: anchorZ });
    const nVoxel = voxelMap.get(nSurfacePos);
    const nEntityType = getEntityTypeFromVoxel(nVoxel);
    const nVariant = getVariantFromVoxel(nVoxel);
    const nSize = getEntitySize(nEntityType, nVariant);

    return { anchorX, anchorZ, entityType: nEntityType, variant: nVariant, size: nSize };
}
