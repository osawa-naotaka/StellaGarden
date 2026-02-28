import type { GameEventMap } from "../engine/Events";
import type { Inventory } from "../engine/Inventory";
import { ENTITY_TYPES, getEntityTypeFromVoxel, getTerrainTypeFromVoxel, TERRAIN_TYPES } from "../engine/TerrainDefs";
import type { EventBroker } from "../lib/Event";
import type { VoxelMap } from "../lib/VoxelMap";

/** 中心座標を含む 3x3 範囲の表面 y がすべて同じかどうかを返す。範囲外タイルが含まれる場合は false。 */
function isFlat3x3(voxelMap: VoxelMap, centerX: number, centerZ: number, centerY: number): boolean {
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
function isSafeToRemove3x3(voxelMap: VoxelMap, centerX: number, centerZ: number): boolean {
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
function isSafeToAdd3x3(voxelMap: VoxelMap, centerX: number, centerZ: number): boolean {
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

/** 選択中のツールに応じてタイルを操作するハンドラを EventBroker に登録し、解除用の dispose 関数を返す。 */
export function createInteractionHandler(
    voxelMap: VoxelMap,
    inventory: Inventory,
    eventBroker: EventBroker<GameEventMap>,
): () => void {
    return eventBroker.subscribe("interact", (packet) => {
        const surfacePos = voxelMap.getSurfacePosition({ x: packet.pos.x, y: 0, z: packet.pos.z });
        const voxel = voxelMap.get(surfacePos);
        const tool = inventory.selectedTool;

        switch (tool) {
            case "watering_can":
                if (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.soil) {
                    voxelMap.set(TERRAIN_TYPES.wetSoil, surfacePos);
                }
                break;
            case "shovel":
                if (
                    getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none &&
                    isSafeToRemove3x3(voxelMap, packet.pos.x, packet.pos.z)
                ) {
                    if (surfacePos.y === 1) {
                        // y=1 の草地を削除し、y=0 を water にして海底に戻す
                        voxelMap.remove(surfacePos);
                        voxelMap.set(TERRAIN_TYPES.water, { x: surfacePos.x, y: 0, z: surfacePos.z });
                        inventory.addItem("dirt", 1);
                    } else if (surfacePos.y > 1) {
                        // y=2 以上の草地を削る → 除去して下の地形を露出
                        voxelMap.remove(surfacePos);
                        inventory.addItem("dirt", 1);
                    }
                }
                break;
            case "axe":
                if (getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.tree) {
                    voxelMap.set(voxel & 0x000000ff, surfacePos);
                    inventory.addItem("wood", 1);
                }
                break;
            case "hoes":
                if (
                    getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass &&
                    getEntityTypeFromVoxel(voxel) === ENTITY_TYPES.none &&
                    isFlat3x3(voxelMap, packet.pos.x, packet.pos.z, surfacePos.y)
                ) {
                    voxelMap.set(TERRAIN_TYPES.soil, surfacePos);
                }
                break;
            case "dirt":
                // water（y=0）または grass（y=1）の上に土を盛って草地にする
                if (
                    (getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.water || getTerrainTypeFromVoxel(voxel) === TERRAIN_TYPES.grass) &&
                    surfacePos.y + 1 < voxelMap.height &&
                    isSafeToAdd3x3(voxelMap, packet.pos.x, packet.pos.z) &&
                    inventory.consumeSelectedItem(1)
                ) {
                    voxelMap.set(TERRAIN_TYPES.grass, { x: surfacePos.x, y: surfacePos.y + 1, z: surfacePos.z });
                }
                break;
        }
    });
}
