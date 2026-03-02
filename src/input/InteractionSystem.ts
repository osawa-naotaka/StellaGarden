import type { GameEventMap } from "../_boundary/events";
import type { IInventoryWriter, IVoxelWriter } from "../_boundary/interfaces";
import { ENTITY_TYPES, getCropGrowthStageFromVoxel, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../engine/TerrainDefs";
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
            if (voxelMap.getSurfacePosition({ x: nx, y: 0, z: nz }).y !== centerY) {
                return false;
            }
        }
    }
    return true;
}

/** 中心を削った後（y - 1）でも、3x3 範囲の各セルとの高さ差が 1 以下に収まるか返す。
 *  範囲外タイルが含まれる場合は false。 */
function isSafeToRemove3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number): boolean {
    const centerY = voxelMap.getSurfacePosition({ x: centerX, y: 0, z: centerZ }).y;
    const newCenterY = centerY - 1;
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            const y = voxelMap.getSurfacePosition({ x: nx, y: 0, z: nz }).y;
            if (Math.abs(newCenterY - y) > 1) return false;
        }
    }
    return true;
}

/** 中心に土を盛った後（y + 1）でも、3x3 範囲の各セルとの高さ差が 1 以下に収まるか返す。
 *  範囲外タイルが含まれる場合は false。 */
function isSafeToAdd3x3(voxelMap: IVoxelWriter, centerX: number, centerZ: number): boolean {
    const centerY = voxelMap.getSurfacePosition({ x: centerX, y: 0, z: centerZ }).y;
    const newCenterY = centerY + 1;
    for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dz === 0) continue;
            const nx = centerX + dx;
            const nz = centerZ + dz;
            if (nx < 0 || nx >= voxelMap.width || nz < 0 || nz >= voxelMap.depth) {
                return false;
            }
            const y = voxelMap.getSurfacePosition({ x: nx, y: 0, z: nz }).y;
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
            const pos = voxelMap.getSurfacePosition({ x: nx, y: 0, z: nz });
            const terrain = getTerrainTypeFromVoxel(voxelMap.get(pos));
            if (isFlat3x3(voxelMap, nx, nz, pos.y)) continue;
            if (terrain === TERRAIN_TYPES.soil || terrain === TERRAIN_TYPES.wetSoil) {
                voxelMap.set(TERRAIN_TYPES.dirt, pos);
            }
        }
    }
}

/** 選択中のツールに応じてタイルを操作するハンドラを EventBroker に登録し、解除用の dispose 関数を返す。 */
export function createInteractionHandler(voxelMap: IVoxelWriter, inventory: IInventoryWriter, eventBroker: EventBroker<GameEventMap>): () => void {
    return eventBroker.subscribe("interact_world", (packet) => {
        const surfacePos = voxelMap.getSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
        const voxel = voxelMap.get(surfacePos);
        const tool = inventory.selectedTool;

        switch (tool) {
            case "hand":
                if (
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.potato &&
                    getCropGrowthStageFromVoxel(voxel) === 5
                ) {
                    const harvestCount = 2 + Math.floor(Math.random() * 3); // 2〜4個
                    if (inventory.addItem("potato", harvestCount)) {
                        voxelMap.set(TERRAIN_TYPES.dirt, surfacePos);
                        eventBroker.publish("crop_harvested", { pos: { x: packet.pos.x, z: packet.pos.z }, itemId: "potato", count: harvestCount });
                    }
                }
                break;
            case "watering_can":
                if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.soil) {
                    // エンティティビットと growthStage を保持したまま地形タイプのみ wetSoil に変更
                    voxelMap.set((voxel & ~0xff) | TERRAIN_TYPES.wetSoil, surfacePos);
                }
                break;
            case "shovel":
                if (
                    (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass || getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.dirt) &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none &&
                    isSafeToRemove3x3(voxelMap, packet.pos.x, packet.pos.z)
                ) {
                    if (surfacePos.y === 1) {
                        // y=1 の草地を削除し、y=0 を water にして海底に戻す
                        // インベントリが満杯の場合はキャンセル
                        if (inventory.addItem("dirt", 1)) {
                            voxelMap.remove(surfacePos);
                            voxelMap.set(TERRAIN_TYPES.water, { x: surfacePos.x, y: 0, z: surfacePos.z });
                            revertNearbyInvalidTerrain(voxelMap, packet.pos.x, packet.pos.z);
                        }
                    } else if (surfacePos.y > 1) {
                        // y=2 以上の草地を削る → 除去して下の地形を露出
                        // インベントリが満杯の場合はキャンセル
                        if (inventory.addItem("dirt", 1)) {
                            voxelMap.remove(surfacePos);
                            revertNearbyInvalidTerrain(voxelMap, packet.pos.x, packet.pos.z);
                        }
                    }
                }
                break;
            case "axe":
                if (getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.tree) {
                    // インベントリが満杯の場合はキャンセル
                    if (inventory.addItem("wood", 1)) {
                        voxelMap.set(voxel & 0x000000ff, surfacePos);
                    }
                }
                break;
            case "hoes": {
                const terrainType = getTerrainTypeFromVoxel(voxel);
                const entityType = getEntityTypeFromVoxel(voxel);
                if (
                    (terrainType === TERRAIN_TYPES.soil || terrainType === TERRAIN_TYPES.wetSoil) &&
                    entityType !== ENTITY_TYPES.none
                ) {
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
            case "potato": {
                const potatoTerrainType = getTerrainTypeFromVoxel(voxel);
                if (
                    (potatoTerrainType === TERRAIN_TYPES.soil || potatoTerrainType === TERRAIN_TYPES.wetSoil) &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none &&
                    inventory.consumeSelectedItem(1)
                ) {
                    // 地形タイプ（soil or wetSoil）を保持してエンティティを追加
                    voxelMap.set(potatoTerrainType | (ENTITY_TYPES.potato << 8), surfacePos);
                    eventBroker.publish("crop_planted", { pos: { x: packet.pos.x, z: packet.pos.z }, cropType: "potato" });
                }
                break;
            }
            case "dirt":
                // 高さ差1以下なら盛れる。さらに3x3が全て同じ高さならdirt、そうでなければgrass
                if (
                    (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.water || getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass || getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.dirt) &&
                    surfacePos.y + 1 < voxelMap.height &&
                    isSafeToAdd3x3(voxelMap, packet.pos.x, packet.pos.z) &&
                    inventory.consumeSelectedItem(1)
                ) {
                    const newTerrain = isFlat3x3(voxelMap, packet.pos.x, packet.pos.z, surfacePos.y + 1)
                        ? TERRAIN_TYPES.dirt
                        : TERRAIN_TYPES.grass;
                    voxelMap.set(newTerrain, { x: surfacePos.x, y: surfacePos.y + 1, z: surfacePos.z });
                    revertNearbyInvalidTerrain(voxelMap, packet.pos.x, packet.pos.z);
                }
                break;
        }
    });
}
