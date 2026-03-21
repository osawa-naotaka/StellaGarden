import type { GameEventMap } from "../_boundary/events";
import type { IInventoryWriter, IVoxelWriter } from "../_boundary/interfaces";
import { getEntityDef, getEntityDefByItemId, type InteractionContext } from "../_registry/EntityRegistry";
import { findFacilityAnchor } from "../engine/ItemDefs";
import {
    ENTITY_TYPES,
    FERTILIZER_TYPES,
    getEntityTypeFromVoxel,
    getFertilizerTypeFromVoxel,
    getTerrainTypeFromVoxel,
    setFertilizerTypeInVoxel,
    TERRAIN_TYPES,
} from "../engine/TerrainDefs";
import { floodFillWater } from "../engine/WaterSystem";
import type { EventBroker } from "../lib/Event";

/** 中心座標を含む 3x3 範囲の表面 y がすべて同じかどうかを返す。範囲外タイルが含まれる場合は false。 */
function isFlat3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number, centerY: number): boolean {
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            if (voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz }).y !== centerY) {
                return false;
            }
        }
    }
    return true;
}

/** 中心を削った後（y - 1）でも、3x3 範囲の各セルとの高さ差が 1 以下に収まるか返す。
 *  範囲外タイルが含まれる場合は false。 */
function isSafeToRemove3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number): boolean {
    const centerY = voxelMap.getGroundSurfacePosition({ x: centerX, y: 0, z: centerZ }).y;
    const newCenterY = centerY - 1;
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            const y = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz }).y;
            if (Math.abs(newCenterY - y) > 1) return false;
        }
    }
    return true;
}

/** 中心に土を盛った後（y + 1）でも、3x3 範囲の各セルとの高さ差が 1 以下に収まるか返す。
 *  範囲外タイルが含まれる場合は false。 */
function isSafeToAdd3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number): boolean {
    const centerY = voxelMap.getGroundSurfacePosition({ x: centerX, y: 0, z: centerZ }).y;
    const newCenterY = centerY + 1;
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            const y = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz }).y;
            if (Math.abs(newCenterY - y) > 1) return false;
        }
    }
    return true;
}

/** (cx, cz) の高さ変化によって isFlat3x3 条件が崩れた近傍 soil/wetSoil タイルを dirt に戻す。 */
function revertNearbyInvalidTerrain(voxelMap: IVoxelWriter, cx: number, cz: number): void {
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) continue;
            const pos = voxelMap.getGroundSurfacePosition({ x: nx, y: 0, z: nz });
            const terrain = getTerrainTypeFromVoxel(voxelMap.get(pos));
            if (isFlat3x3(voxelMap, nx, nz, pos.y)) continue;
            if (terrain === TERRAIN_TYPES.soil || terrain === TERRAIN_TYPES.wetSoil) {
                voxelMap.set(TERRAIN_TYPES.dirt, pos);
            }
        }
    }
}

/** 選択中のツールに応じてタイルを操作するハンドラを EventBroker に登録し、解除用の dispose 関数を返す。
 * onTerrainModified が指定された場合、地形変更操作（掘る・盛る）の後に呼び出される。 */
export function createInteractionHandler(
    voxelMap: IVoxelWriter,
    inventory: IInventoryWriter,
    eventBroker: EventBroker<GameEventMap>,
    onTerrainModified?: () => void,
): () => void {
    return eventBroker.subscribe("interact_world", (packet) => {
        const surfacePos = voxelMap.getSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
        const voxel = voxelMap.get(surfacePos);
        const terrainType = getTerrainTypeFromVoxel(voxel);
        const tool = inventory.selectedTool;

        // 水源ブロックは操作対象外（破壊不能）
        if (terrainType === TERRAIN_TYPES.waterSource) return;

        const ctx: InteractionContext = { voxelMap, inventory, eventBroker, surfacePos, voxel, tool };

        // facility_part → アンカーの entityType に解決してからディスパッチ
        let entityType = getEntityTypeFromVoxel(voxel);
        if (entityType === ENTITY_TYPES.facility_part) {
            const anchor = findFacilityAnchor(voxelMap, packet.pos.x, packet.pos.z);
            if (anchor?.def.entityType != null) entityType = anchor.def.entityType;
        }

        // パス1: エンティティベース — 対象地点のエンティティに委譲（例: 収穫・撤去・クラフトUI）
        const entityDef = getEntityDef(entityType);
        if (entityDef?.onInteract?.(ctx)) return;

        // パス2: アイテムベース — 手持ちアイテムに対応するエンティティに委譲（例: 植え付け）
        if (tool) {
            const itemDef = getEntityDefByItemId(tool);
            if (itemDef?.onItemUse?.(ctx)) return;
        }

        // パス3: フォールバック — 未移行エンティティ・ツール固有の地形操作
        switch (tool) {
            case "hand":
                break;
            case "watering_can":
                if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.soil) {
                    // エンティティビットと growthStage を保持したまま地形タイプのみ wetSoil に変更
                    voxelMap.set((voxel & ~0xff) | TERRAIN_TYPES.wetSoil, surfacePos);
                }
                break;
            case "shovel":
                if (
                    (terrainType === TERRAIN_TYPES.grass || terrainType === TERRAIN_TYPES.dirt) &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none &&
                    isSafeToRemove3x3(voxelMap, packet.pos.x, packet.pos.z)
                ) {
                    if (surfacePos.y >= 1) {
                        if (inventory.addItem("dirt", 1)) {
                            voxelMap.remove(surfacePos);
                            revertNearbyInvalidTerrain(voxelMap, packet.pos.x, packet.pos.z);
                            floodFillWater(voxelMap, packet.pos.x, packet.pos.z);
                            onTerrainModified?.();
                        }
                    }
                }
                break;
            case "hoes": {
                const terrainType = getTerrainTypeFromVoxel(voxel);
                const entityType = getEntityTypeFromVoxel(voxel);
                if ((terrainType === TERRAIN_TYPES.soil || terrainType === TERRAIN_TYPES.wetSoil) && entityType !== ENTITY_TYPES.none) {
                    // 作物エンティティを削除（虚空へ消滅、アイテム追加なし）
                    voxelMap.set(terrainType, surfacePos);
                } else if (
                    (terrainType === TERRAIN_TYPES.grass || terrainType === TERRAIN_TYPES.dirt) &&
                    entityType === ENTITY_TYPES.none &&
                    isFlat3x3(voxelMap, packet.pos.x, packet.pos.z, surfacePos.y)
                ) {
                    voxelMap.set(TERRAIN_TYPES.soil, surfacePos);
                }
                break;
            }
            case "compost":
            case "plant_ashes":
            case "oil_cake": {
                const fertTerrainType = getTerrainTypeFromVoxel(voxel);
                if (
                    (fertTerrainType === TERRAIN_TYPES.soil || fertTerrainType === TERRAIN_TYPES.wetSoil) &&
                    getFertilizerTypeFromVoxel(voxel) === 0 &&
                    inventory.consumeSelectedItem(1)
                ) {
                    const fertType =
                        tool === "compost" ? FERTILIZER_TYPES.compost : tool === "plant_ashes" ? FERTILIZER_TYPES.plant_ashes : FERTILIZER_TYPES.oil_cake;
                    voxelMap.set(setFertilizerTypeInVoxel(voxel, fertType), surfacePos);
                }
                break;
            }
            case "dirt": {
                // 水タイルを無視して地面の高さを取得し、地面の1つ上にdirtを配置する
                const groundPos = voxelMap.getGroundSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
                const groundVoxel = voxelMap.get(groundPos);
                const groundTerrainType = getTerrainTypeFromVoxel(groundVoxel);
                if (
                    (groundTerrainType === TERRAIN_TYPES.grass || groundTerrainType === TERRAIN_TYPES.dirt) &&
                    groundPos.y + 1 < voxelMap.height &&
                    isSafeToAdd3x3(voxelMap, packet.pos.x, packet.pos.z) &&
                    inventory.consumeSelectedItem(1)
                ) {
                    voxelMap.set(TERRAIN_TYPES.dirt, { x: groundPos.x, y: groundPos.y + 1, z: groundPos.z });
                    revertNearbyInvalidTerrain(voxelMap, packet.pos.x, packet.pos.z);
                    onTerrainModified?.();
                }
                break;
            }
        }
    });
}
