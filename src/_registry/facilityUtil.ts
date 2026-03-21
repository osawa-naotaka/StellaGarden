import type { IInventoryWriter, IVoxelWriter } from "../_boundary/interfaces";
import { findFacilityAnchor, type ItemDef } from "../engine/ItemDefs";

/** 施設を撤去してインベントリに回収する。成功時 true。 */
export function removeFacility(voxelMap: IVoxelWriter, inventory: IInventoryWriter, anchorX: number, anchorZ: number, def: ItemDef): boolean {
    if (!inventory.addItem(def.id, 1)) return false;

    const { w, h } = def.entitySize ?? { w: 1, h: 1 };
    for (let dz = 0; dz < h; dz++) {
        for (let dx = 0; dx < w; dx++) {
            const pos = voxelMap.getSurfacePosition({ x: anchorX + dx, y: 0, z: anchorZ + dz });
            const v = voxelMap.get(pos);
            voxelMap.set(v & 0xff, pos);
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
): boolean {
    const anchor = findFacilityAnchor(voxelMap, x, z);
    if (!anchor || anchor.def.entityType !== expectedEntityType) return false;
    return removeFacility(voxelMap, inventory, anchor.anchorX, anchor.anchorZ, anchor.def);
}
