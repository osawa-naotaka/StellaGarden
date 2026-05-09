import type { IInventoryWriter, ItemId, IVoxelReader, IVoxelWriter, Pos2D } from "../_boundary/interfaces";
import { ENTITY_TYPES, getEntityTypeFromVoxel, setEntityTypeInVoxel } from "../engine/VoxelDefs";
import { getEntityDef } from "./EntityRegistry";
import { getItemDefByEntityType } from "./ItemRegistry";

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
function getEntitySize(entityType: number): { w: number; h: number } {
    return getEntityDef(entityType).entitySize;
}

/** 施設を撤去してインベントリに回収する。成功時 true。 */
export function removeFacility(voxelMap: IVoxelWriter, inventory: IInventoryWriter, anchorX: number, anchorZ: number, entityType: number): boolean {
    const def = getItemDefByEntityType(entityType);
    if (!def) return false;
    if (!def.placement) return false;
    if (!inventory.addItems([{ itemId: def.itemId as ItemId, count: 1 }])) return false;

    const { w, h } = getEntitySize(def.placement.entityType);
    for (let dz = 0; dz < h; dz++) {
        for (let dx = 0; dx < w; dx++) {
            const pos = voxelMap.getSurfacePosition({ x: anchorX + dx, y: 0, z: anchorZ + dz });
            const v = voxelMap.get(pos);
            voxelMap.set(setEntityTypeInVoxel(v, ENTITY_TYPES.none), pos);
        }
    }
    return true;
}

/** ctx の surfacePos からアンカーを解決し、施設を撤去する。成功時 true。 */
export function removeFacilityAtPos(voxelMap: IVoxelWriter, inventory: IInventoryWriter, x: number, z: number, expectedEntityType: number): boolean {
    const anchor = findFacilityAnchor(voxelMap, x, z);
    if (!anchor || anchor.entityType !== expectedEntityType) return false;
    return removeFacility(voxelMap, inventory, anchor.anchorX, anchor.anchorZ, anchor.entityType);
}

/** 施設をフィールドに配置する（アンカー + facility_part の voxel 書き込み）。 */
export function placeFacility(voxelMap: IVoxelWriter, pos: Pos2D, entityType: number, entitySize: { w: number; h: number }): void {
    for (let dz = 0; dz < entitySize.h; dz++) {
        for (let dx = 0; dx < entitySize.w; dx++) {
            const surfacePos = voxelMap.getSurfacePosition({ x: pos.x + dx, y: 0, z: pos.z + dz });
            const voxel = voxelMap.get(surfacePos);
            const entity = dx === 0 && dz === 0 ? entityType : ENTITY_TYPES.facility_part;
            voxelMap.set(setEntityTypeInVoxel(voxel, entity), surfacePos);
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
): { anchorX: number; anchorZ: number; entityType: number; size: { w: number; h: number } } {
    const surfacePos = voxelMap.getSurfacePosition({ x, y: 0, z });
    const voxel = voxelMap.get(surfacePos);
    const entityType = getEntityTypeFromVoxel(voxel);

    if (entityType === ENTITY_TYPES.none) throw new Error("entity is empty.");

    // facility_part の場合: 近傍を探索してアンカーを見つける
    if (entityType !== ENTITY_TYPES.facility_part) {
        // アンカータイルの場合: 直接返す
        const size = getEntitySize(entityType);
        return { anchorX: x, anchorZ: z, entityType, size };
    }

    // 最大施設サイズを考慮して探索（左に最大2、上に最大3）
    for (let dz = 0; dz >= -3; dz--) {
        for (let dx = 0; dx >= -2; dx--) {
            if (dx === 0 && dz === 0) continue;
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= voxelMap.width || nz >= voxelMap.depth) continue;

            const nSurfacePos = voxelMap.getSurfacePosition({ x: nx, y: 0, z: nz });
            const nVoxel = voxelMap.get(nSurfacePos);
            const nEntityType = getEntityTypeFromVoxel(nVoxel);

            if (nEntityType === ENTITY_TYPES.none) continue;
            if (nEntityType === ENTITY_TYPES.facility_part) continue;

            const nSize = getEntitySize(nEntityType);

            // このアンカーの entitySize が (x, z) を包含するか確認
            if (x >= nx && x < nx + nSize.w && z >= nz && z < nz + nSize.h) {
                return { anchorX: nx, anchorZ: nz, entityType: nEntityType, size: nSize };
            }
        }
    }

    throw new Error("No anchor found");
}
